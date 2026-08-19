import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';
import useNormActions from '../hooks/useNormActions';
import usePaletteActions from '../hooks/usePaletteActions';
import {
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_DUPLICATE_SUFFIX,
  DEMO_SHARE_TOKEN,
} from '../constants/backendContract';

export const ProjectContext = createContext(null);

// Pagination defaults; the page size mirrors the backend default so the very
// first request and its follow-ups stay consistent.
const DEFAULT_PAGINATION = { page: 1, pageSize: 12, total: 0, totalPages: 1 };

export const ProjectProvider = ({ children }) => {
  const { user, authLoading, setGlobalError } = useAuth();
  // The demo account is read-only server-side (authenticateToken.js rejects
  // every mutating request before it can reach the database) — so content
  // mutations are simulated here instead: applied to local state only, never
  // sent to the API, giving a fully interactive demo with zero DB writes.
  // A reload re-fetches the real (unedited) seeded data, naturally "resetting"
  // the demo for the next visitor.
  const isDemo = Boolean(user?.isDemo);
  // Always-negative, monotonic ids for demo-simulated rows: unique for the
  // session, and never collide with real (positive) database ids.
  const nextDemoIdRef = useRef(0);
  const nextDemoId = () => {
    nextDemoIdRef.current -= 1;
    return nextDemoIdRef.current;
  };

  const [projects, setProjects] = useState([]);
  const [projectsPagination, setProjectsPagination] = useState(DEFAULT_PAGINATION);
  // Unfiltered project total, for the dashboard's "you have N projects" stat:
  // pagination.total follows the active search filter, so it can't be used
  // there without the hero count changing while the user types a search.
  const [projectsTotalAll, setProjectsTotalAll] = useState(0);
  const adjustProjectsTotalAll = useCallback((delta) => {
    setProjectsTotalAll((total) => Math.max(0, total + delta));
  }, []);
  // Mirror of the latest pagination so loadMoreProjects can read it without
  // depending on (and re-creating itself on) every pagination change.
  const paginationRef = useRef(DEFAULT_PAGINATION);
  const updatePagination = useCallback((next) => {
    paginationRef.current = next;
    setProjectsPagination(next);
  }, []);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  // Soft-deleted projects (restorable for 30 days); loaded by the dashboard.
  const [trashedProjects, setTrashedProjects] = useState([]);
  // Soft-deleted colors/standards of whichever project's Palette/Standards page
  // is currently open (restorable for 30 days), same trash lifecycle as projects.
  const [trashedPaletteColors, setTrashedPaletteColors] = useState([]);
  const [trashedBrushNorms, setTrashedBrushNorms] = useState([]);
  const [trashedTypographyNorms, setTrashedTypographyNorms] = useState([]);
  // Live mirrors of the trash lists, read by the demo-mode branch of the
  // fetchers below. They must NOT close over the state directly: with the state
  // in their deps, every fetch (which stores a fresh array) would give the
  // fetcher a new identity, re-triggering the pages' "load the trash" effects —
  // which depend on the fetcher — in an endless request loop.
  const trashedProjectsRef = useRef([]);
  const trashedPaletteColorsRef = useRef([]);
  const trashedBrushNormsRef = useRef([]);
  const trashedTypographyNormsRef = useRef([]);
  useEffect(() => {
    trashedProjectsRef.current = trashedProjects;
    trashedPaletteColorsRef.current = trashedPaletteColors;
    trashedBrushNormsRef.current = trashedBrushNorms;
    trashedTypographyNormsRef.current = trashedTypographyNorms;
  }, [trashedProjects, trashedPaletteColors, trashedBrushNorms, trashedTypographyNorms]);
  // Monotonic token to discard out-of-order responses: two interleaved fetches
  // (silent page-1 on login + a "load more", or a StrictMode double-mount) must
  // not let a stale response overwrite the newer list/pagination.
  const fetchSeq = useRef(0);
  // Mirrors the current search term so loadMoreProjects/refetchLoadedProjects
  // can keep paginating within it without the caller having to repeat it.
  const searchRef = useRef('');

  // Fetches a page of projects. Page 1 replaces the list; later pages are
  // appended and de-duplicated by id (so an insertion between fetches can't
  // produce duplicate React keys). silent suppresses the global error banner.
  // search filters by name server-side; omitting it keeps the current term.
  const fetchProjects = useCallback(
    async ({ silent = false, page = 1, search } = {}) => {
      if (!user?.id) {
        setProjects([]);
        updatePagination(DEFAULT_PAGINATION);
        setProjectsLoading(false);
        return [];
      }

      if (search !== undefined) searchRef.current = search;
      const searchParam = searchRef.current
        ? `&search=${encodeURIComponent(searchRef.current)}`
        : '';

      const seq = (fetchSeq.current += 1);
      setProjectsLoading(true);

      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects?page=${page}${searchParam}`, options);
        // A newer fetch started while this one was in flight: drop this response.
        if (seq !== fetchSeq.current) {
          return data?.projects || [];
        }
        const fetched = data?.projects || [];
        const nextPagination = data?.pagination || { ...DEFAULT_PAGINATION, total: fetched.length };
        updatePagination(nextPagination);
        // Only an unfiltered fetch may update the unfiltered total: a search's
        // total reflects the filter and must not leak into the dashboard stat.
        if (!searchRef.current) {
          setProjectsTotalAll(nextPagination.total);
        }
        setProjects((prev) => {
          if (page <= 1) return fetched;
          const seen = new Set(prev.map((p) => String(p.id)));
          return [...prev, ...fetched.filter((p) => !seen.has(String(p.id)))];
        });
        return fetched;
      } catch (error) {
        logger.error('projects.fetch.error', error);
        return [];
      } finally {
        // Only the latest fetch owns the loading flag.
        if (seq === fetchSeq.current) {
          setProjectsLoading(false);
        }
      }
    },
    [user?.id, setGlobalError, updatePagination],
  );

  /** Loads the next page of projects (appended), if any remain. */
  const loadMoreProjects = useCallback(() => {
    const { page, totalPages } = paginationRef.current;
    if (page >= totalPages) return;
    fetchProjects({ page: page + 1 });
  }, [fetchProjects]);

  // Re-fetches every currently-loaded page, in order. Used after a mutation
  // whose result's position in the server-side order can't be predicted locally
  // (e.g. restoring a trashed project: its created_at may place it anywhere,
  // not necessarily at the top) — a plain "refetch page 1" would otherwise
  // silently truncate an already-loaded multi-page grid back down to 12 items.
  const refetchLoadedProjects = useCallback(async () => {
    const pagesLoaded = Math.max(1, paginationRef.current.page);
    await fetchProjects({ silent: true, page: 1 });
    // Sequential by design: each page's de-dup in fetchProjects reads the list
    // state left by the previous page's fetch.
    for (let page = 2; page <= pagesLoaded; page += 1) {
      await fetchProjects({ silent: true, page });
    }
  }, [fetchProjects]);

  // Load projects once auth has settled. Logging out (no user) clears state.
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setProjects([]);
      setTrashedProjects([]);
      setActiveProjectId(null);
      setProjectsLoading(false);
      setProjectsTotalAll(0);
      return;
    }

    fetchProjects({ silent: true });
  }, [authLoading, user?.id, fetchProjects]);

  // Resolve the active project object from its id. String() compares because
  // the route param is a string while project ids may be numbers.
  const activeProject = useMemo(
    () => projects.find((project) => String(project.id) === String(activeProjectId)) || null,
    [projects, activeProjectId],
  );

  // Deep-link resolution: the list is paginated, so a hard reload (or direct
  // link) on a project beyond the loaded pages can't find it locally. Rather
  // than wrongly showing "Project not found", fetch it by id once and merge it
  // into the list; only a confirmed failure marks it missing. The one-lookup-
  // per-id guard is a ref (not state in the deps), so starting the lookup
  // can't re-run the effect and self-cancel the in-flight request.
  const [activeProjectNotFound, setActiveProjectNotFound] = useState(false);
  const activeProjectLookupRef = useRef(null);
  useEffect(() => {
    setActiveProjectNotFound(false);
    activeProjectLookupRef.current = null;
  }, [activeProjectId]);
  useEffect(() => {
    if (authLoading || !user?.id || !activeProjectId) return undefined;
    if (activeProject || projectsLoading) return undefined;
    // Already looked this id up (in flight or settled): never retry in a loop.
    if (String(activeProjectLookupRef.current) === String(activeProjectId)) return undefined;
    activeProjectLookupRef.current = activeProjectId;

    // Demo-simulated projects live only in local state: after a reload they
    // are legitimately gone, and the API would reject the lookup anyway.
    if (isDemo) {
      setActiveProjectNotFound(true);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const project = await api.get(`/projects/${activeProjectId}`);
        if (cancelled) return;
        if (project?.id) {
          setProjects((prev) =>
            prev.some((p) => String(p.id) === String(project.id)) ? prev : [...prev, project],
          );
        } else {
          setActiveProjectNotFound(true);
        }
      } catch (error) {
        if (cancelled) return;
        if (error?.status !== 404) {
          logger.error('projects.fetchById.error', error);
        }
        setActiveProjectNotFound(true);
      }
    })();

    return () => {
      cancelled = true;
      // A teardown mid-flight (e.g. a concurrent list fetch flipped
      // projectsLoading) drops the response above; release the guard so the
      // re-run can retry instead of sticking on the loading state forever.
      if (String(activeProjectLookupRef.current) === String(activeProjectId)) {
        activeProjectLookupRef.current = null;
      }
    };
  }, [authLoading, user?.id, activeProjectId, activeProject, projectsLoading, isDemo]);

  // Creates a project and prepends it to the local list. Returns the created
  // project on success, or null on failure (so callers can gate toasts/modals).
  const addProject = useCallback(
    async (name) => {
      if (!user) return null;

      if (isDemo) {
        const newProject = {
          id: nextDemoId(),
          name,
          lastEdited: 'Just now',
          shareToken: null,
          pinned: false,
          brushNorms: [],
          typographyNorms: [],
          normsCount: 0,
          palette: [],
        };
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        adjustProjectsTotalAll(1);
        return newProject;
      }

      try {
        const newProject = await api.post('/projects', { name }, { onGlobalError: setGlobalError });
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        adjustProjectsTotalAll(1);
        return newProject;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to add the project.');
        logger.error('projects.add.error', error);
        return null;
      }
    },
    [user, isDemo, setGlobalError, updatePagination, adjustProjectsTotalAll],
  );

  // Fetches the trashed projects (small list: id, name, days left). Refreshed
  // by the dashboard on mount and after every trash mutation.
  const fetchTrashedProjects = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) {
        setTrashedProjects([]);
        return [];
      }
      // The demo account's trash is simulated locally (see deleteProject); a
      // real fetch would return the account's actual (empty) trash and wipe
      // it out from under the visitor.
      if (isDemo) {
        return trashedProjectsRef.current;
      }

      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get('/projects/trash', options);
        const fetched = data?.projects || [];
        setTrashedProjects(fetched);
        return fetched;
      } catch (error) {
        logger.error('projects.fetchTrash.error', error);
        return [];
      }
    },
    [user?.id, isDemo, setGlobalError],
  );

  // Restores a trashed project. The full project (norms + palette) comes back
  // to the grid via a refetch of every page already loaded (not just page 1),
  // so a multi-page grid doesn't collapse back down to the first page.
  // Returns true on success.
  const restoreProject = useCallback(
    async (id) => {
      if (isDemo) {
        const restored = trashedProjects.find((project) => String(project.id) === String(id));
        setTrashedProjects((prev) => prev.filter((project) => String(project.id) !== String(id)));
        if (restored) {
          const { daysLeft: _daysLeft, ...projectFields } = restored;
          setProjects((prev) => [projectFields, ...prev]);
          updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
          adjustProjectsTotalAll(1);
        }
        return true;
      }

      try {
        await api.post(`/projects/${id}/restore`, {}, { onGlobalError: setGlobalError });
        setTrashedProjects((prev) => prev.filter((project) => String(project.id) !== String(id)));
        // Keep the unfiltered total right even while a search is active (the
        // refetch below only overwrites it when no filter is applied).
        adjustProjectsTotalAll(1);
        await refetchLoadedProjects();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the project.');
        logger.error('projects.restore.error', error);
        return false;
      }
    },
    [
      isDemo,
      trashedProjects,
      setGlobalError,
      updatePagination,
      refetchLoadedProjects,
      adjustProjectsTotalAll,
    ],
  );

  // Permanently deletes a TRASHED project (irreversible). Returns true on success.
  const deleteProjectPermanently = useCallback(
    async (id) => {
      if (isDemo) {
        setTrashedProjects((prev) => prev.filter((project) => String(project.id) !== String(id)));
        return true;
      }

      try {
        await api.delete(`/projects/${id}/permanent`, null, { onGlobalError: setGlobalError });
        setTrashedProjects((prev) => prev.filter((project) => String(project.id) !== String(id)));
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the project.');
        logger.error('projects.deletePermanently.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Enables public sharing: the server mints (or returns) the project's stable
  // share token, mirrored locally. Returns the token, or null on failure.
  const enableSharing = useCallback(
    async (projectId) => {
      if (isDemo) {
        // Reuse the seeded token (migration 019) rather than a fabricated one,
        // so the public share page keeps working no matter how many times a
        // visitor toggles it off and back on.
        const shareToken = DEMO_SHARE_TOKEN;
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId) ? { ...project, shareToken } : project,
          ),
        );
        return shareToken;
      }

      try {
        const data = await api.post(
          `/projects/${projectId}/share`,
          {},
          { onGlobalError: setGlobalError },
        );
        const shareToken = data?.shareToken || null;
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId) ? { ...project, shareToken } : project,
          ),
        );
        return shareToken;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to create the share link.');
        logger.error('projects.enableSharing.error', error);
        return null;
      }
    },
    [isDemo, setGlobalError],
  );

  // Disables public sharing: the link dies immediately server-side.
  const disableSharing = useCallback(
    async (projectId) => {
      if (isDemo) {
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId) ? { ...project, shareToken: null } : project,
          ),
        );
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/share`, null, { onGlobalError: setGlobalError });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId) ? { ...project, shareToken: null } : project,
          ),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to disable the share link.');
        logger.error('projects.disableSharing.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Duplicates a project (norms + palette copied server-side) and prepends the
  // copy to the local list. Returns the new project on success, or null.
  const duplicateProject = useCallback(
    async (id) => {
      if (isDemo) {
        const source = projects.find((project) => String(project.id) === String(id));
        if (!source) return null;
        const baseName =
          source.name.length + PROJECT_DUPLICATE_SUFFIX.length > PROJECT_NAME_MAX_LENGTH
            ? source.name.slice(0, PROJECT_NAME_MAX_LENGTH - PROJECT_DUPLICATE_SUFFIX.length)
            : source.name;
        const newProject = {
          ...source,
          id: nextDemoId(),
          name: baseName + PROJECT_DUPLICATE_SUFFIX,
          lastEdited: 'Just now',
          shareToken: null,
          pinned: false,
          palette: (source.palette || []).map((color) => ({ ...color, id: nextDemoId() })),
          brushNorms: (source.brushNorms || []).map((norm) => ({ ...norm, id: nextDemoId() })),
          typographyNorms: (source.typographyNorms || []).map((norm) => ({
            ...norm,
            id: nextDemoId(),
          })),
        };
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        adjustProjectsTotalAll(1);
        return newProject;
      }

      try {
        const newProject = await api.post(
          `/projects/${id}/duplicate`,
          {},
          { onGlobalError: setGlobalError },
        );
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        adjustProjectsTotalAll(1);
        return newProject;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to duplicate the project.');
        logger.error('projects.duplicate.error', error);
        return null;
      }
    },
    [isDemo, projects, setGlobalError, updatePagination, adjustProjectsTotalAll],
  );

  // Pins a project to the top of the dashboard. Moves it locally to just after
  // the other pinned projects, mirroring the server's append-to-end-of-pin-order
  // behavior, so the dashboard's pinned section doesn't jump around on refetch.
  const pinProject = useCallback(
    async (projectId) => {
      const applyPin = () =>
        setProjects((prev) => {
          const target = prev.find((project) => String(project.id) === String(projectId));
          if (!target) return prev;
          const rest = prev.filter((project) => String(project.id) !== String(projectId));
          const firstUnpinnedIndex = rest.findIndex((project) => !project.pinned);
          const insertAt = firstUnpinnedIndex === -1 ? rest.length : firstUnpinnedIndex;
          const next = [...rest];
          next.splice(insertAt, 0, { ...target, pinned: true });
          return next;
        });

      if (isDemo) {
        applyPin();
        return true;
      }

      try {
        await api.post(`/projects/${projectId}/pin`, {}, { onGlobalError: setGlobalError });
        applyPin();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to pin the project.');
        logger.error('projects.pin.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Unpins a project; it naturally falls back into the "Your projects" section
  // wherever it lands next time the grid is refetched.
  const unpinProject = useCallback(
    async (projectId) => {
      const applyUnpin = () =>
        setProjects((prev) =>
          prev.map((project) =>
            String(project.id) === String(projectId) ? { ...project, pinned: false } : project,
          ),
        );

      if (isDemo) {
        applyUnpin();
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/pin`, null, { onGlobalError: setGlobalError });
        applyUnpin();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to unpin the project.');
        logger.error('projects.unpin.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Reorders the user's pinned projects. Only bumps the request server-side;
  // the caller (the dashboard's drag hook) owns the optimistic local order.
  const reorderPinnedProjects = useCallback(
    async (orderedIds) => {
      if (isDemo) return true;

      try {
        await api.post('/projects/pinned/reorder', orderedIds, { onGlobalError: setGlobalError });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to reorder the pinned projects.');
        logger.error('projects.reorderPinned.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Moves a project to the trash (soft delete server-side) and removes it from
  // the grid, clearing the active id if it matched. The trash list is refreshed
  // silently so the dashboard's trash section stays accurate. Returns true on
  // success, false on failure.
  const deleteProject = useCallback(
    async (id) => {
      if (isDemo) {
        const target = projects.find((project) => String(project.id) === String(id));
        setProjects((prevProjects) =>
          prevProjects.filter((project) => String(project.id) !== String(id)),
        );
        updatePagination({
          ...paginationRef.current,
          total: Math.max(0, paginationRef.current.total - 1),
        });
        adjustProjectsTotalAll(-1);
        if (String(activeProjectId) === String(id)) {
          setActiveProjectId(null);
        }
        if (target) {
          setTrashedProjects((prev) => [{ ...target, daysLeft: 30 }, ...prev]);
        }
        return true;
      }

      try {
        await api.delete(`/projects/${id}`, null, { onGlobalError: setGlobalError });
        setProjects((prevProjects) =>
          prevProjects.filter((project) => String(project.id) !== String(id)),
        );
        updatePagination({
          ...paginationRef.current,
          total: Math.max(0, paginationRef.current.total - 1),
        });
        adjustProjectsTotalAll(-1);
        if (String(activeProjectId) === String(id)) {
          setActiveProjectId(null);
        }
        fetchTrashedProjects({ silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the project.');
        logger.error('projects.delete.error', error);
        return false;
      }
    },
    [
      isDemo,
      projects,
      activeProjectId,
      setGlobalError,
      updatePagination,
      fetchTrashedProjects,
      adjustProjectsTotalAll,
    ],
  );

  // The palette's whole lifecycle (bulk replace, per-color trash/restore/
  // permanent delete) lives in usePaletteActions — the same extraction
  // useNormActions is for standards.
  const {
    updateProjectPalette,
    fetchTrashedColors,
    deleteColor,
    restoreColor,
    deleteColorPermanently,
  } = usePaletteActions({
    isDemo,
    projects,
    setProjects,
    setGlobalError,
    nextDemoId,
    trashedPaletteColors,
    setTrashedPaletteColors,
    trashedPaletteColorsRef,
  });

  // Renames a project and locally marks it as just edited. Returns true on
  // success, false on failure.
  const updateProjectName = useCallback(
    async (projectId, { name }) => {
      if (isDemo) {
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? { ...project, name, lastEdited: 'Just now' }
              : project,
          ),
        );
        return true;
      }

      try {
        await api.patch(`/projects/${projectId}`, { name }, { onGlobalError: setGlobalError });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? { ...project, name, lastEdited: 'Just now' }
              : project,
          ),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to rename the project.');
        logger.error('projects.updateName.error', error);
        return false;
      }
    },
    [isDemo, setGlobalError],
  );

  // Brush and typography standards have an identical CRUD lifecycle (add,
  // trash, restore, permanent delete, update, reorder); useNormActions
  // implements it once and is instantiated per kind here, rather than
  // maintaining two ~250-line copies of the same logic.
  const {
    addNorm: addBrushNorm,
    fetchTrashedNorms: fetchTrashedBrushNorms,
    deleteNorm: deleteBrushNorm,
    restoreNorm: restoreBrushNorm,
    deleteNormPermanently: deleteBrushNormPermanently,
    updateNorm: updateBrushNorm,
    reorderNorms: reorderBrushNorms,
  } = useNormActions({
    kind: 'BrushNorm',
    fieldName: 'brushNorms',
    apiSegment: 'brush-norms',
    isDemo,
    projects,
    setProjects,
    setGlobalError,
    nextDemoId,
    trashedItems: trashedBrushNorms,
    setTrashedItems: setTrashedBrushNorms,
    trashedItemsRef: trashedBrushNormsRef,
  });

  const {
    addNorm: addTypographyNorm,
    fetchTrashedNorms: fetchTrashedTypographyNorms,
    deleteNorm: deleteTypographyNorm,
    restoreNorm: restoreTypographyNorm,
    deleteNormPermanently: deleteTypographyNormPermanently,
    updateNorm: updateTypographyNorm,
    reorderNorms: reorderTypographyNorms,
  } = useNormActions({
    kind: 'TypographyNorm',
    fieldName: 'typographyNorms',
    apiSegment: 'typography-norms',
    isDemo,
    projects,
    setProjects,
    setGlobalError,
    nextDemoId,
    trashedItems: trashedTypographyNorms,
    setTrashedItems: setTrashedTypographyNorms,
    trashedItemsRef: trashedTypographyNormsRef,
  });

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(
    () => ({
      projects,
      projectsPagination,
      projectsTotalAll,
      activeProjectNotFound,
      trashedProjects,
      trashedPaletteColors,
      trashedBrushNorms,
      trashedTypographyNorms,
      activeProjectId,
      activeProject,
      projectsLoading,
      setActiveProjectId,
      fetchProjects,
      fetchTrashedProjects,
      loadMoreProjects,
      addProject,
      duplicateProject,
      deleteProject,
      restoreProject,
      deleteProjectPermanently,
      pinProject,
      unpinProject,
      reorderPinnedProjects,
      enableSharing,
      disableSharing,
      updateProjectName,
      updateProjectPalette,
      fetchTrashedColors,
      deleteColor,
      restoreColor,
      deleteColorPermanently,
      addBrushNorm,
      addTypographyNorm,
      fetchTrashedBrushNorms,
      fetchTrashedTypographyNorms,
      deleteBrushNorm,
      deleteTypographyNorm,
      restoreBrushNorm,
      restoreTypographyNorm,
      deleteBrushNormPermanently,
      deleteTypographyNormPermanently,
      updateBrushNorm,
      updateTypographyNorm,
      reorderBrushNorms,
      reorderTypographyNorms,
    }),
    [
      projects,
      projectsPagination,
      projectsTotalAll,
      activeProjectNotFound,
      trashedProjects,
      trashedPaletteColors,
      trashedBrushNorms,
      trashedTypographyNorms,
      activeProjectId,
      activeProject,
      projectsLoading,
      fetchProjects,
      fetchTrashedProjects,
      loadMoreProjects,
      addProject,
      duplicateProject,
      deleteProject,
      restoreProject,
      deleteProjectPermanently,
      pinProject,
      unpinProject,
      reorderPinnedProjects,
      enableSharing,
      disableSharing,
      updateProjectName,
      updateProjectPalette,
      fetchTrashedColors,
      deleteColor,
      restoreColor,
      deleteColorPermanently,
      addBrushNorm,
      addTypographyNorm,
      fetchTrashedBrushNorms,
      fetchTrashedTypographyNorms,
      deleteBrushNorm,
      deleteTypographyNorm,
      restoreBrushNorm,
      restoreTypographyNorm,
      deleteBrushNormPermanently,
      deleteTypographyNormPermanently,
      updateBrushNorm,
      updateTypographyNorm,
      reorderBrushNorms,
      reorderTypographyNorms,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

// Accessor hook for the project context. Throws if used outside a ProjectProvider.
export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
