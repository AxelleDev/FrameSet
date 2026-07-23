/**
 * Project context: holds the user's projects and the active project, exposing
 * CRUD for projects, palette and norms via useProjects(). Mutations optimistically
 * update local state (no refetch); failures go to the global error banner.
 */
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

export const ProjectContext = createContext(null);

// Pagination defaults; the page size mirrors the backend default so the very
// first request and its follow-ups stay consistent.
const DEFAULT_PAGINATION = { page: 1, pageSize: 12, total: 0, totalPages: 1 };

export const ProjectProvider = ({ children }) => {
  const { user, authLoading, setGlobalError } = useAuth();

  const [projects, setProjects] = useState([]);
  const [projectsPagination, setProjectsPagination] = useState(DEFAULT_PAGINATION);
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
        updatePagination(data?.pagination || { ...DEFAULT_PAGINATION, total: fetched.length });
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

  // Creates a project and prepends it to the local list. Returns the created
  // project on success, or null on failure (so callers can gate toasts/modals).
  const addProject = useCallback(
    async (name) => {
      if (!user) return null;

      try {
        const newProject = await api.post('/projects', { name }, { onGlobalError: setGlobalError });
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        return newProject;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to add the project.');
        logger.error('projects.add.error', error);
        return null;
      }
    },
    [user, setGlobalError, updatePagination],
  );

  // Fetches the trashed projects (small list: id, name, days left). Refreshed
  // by the dashboard on mount and after every trash mutation.
  const fetchTrashedProjects = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) {
        setTrashedProjects([]);
        return [];
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
    [user?.id, setGlobalError],
  );

  // Restores a trashed project. The full project (norms + palette) comes back
  // to the grid via a refetch of every page already loaded (not just page 1),
  // so a multi-page grid doesn't collapse back down to the first page.
  // Returns true on success.
  const restoreProject = useCallback(
    async (id) => {
      try {
        await api.post(`/projects/${id}/restore`, {}, { onGlobalError: setGlobalError });
        setTrashedProjects((prev) => prev.filter((project) => String(project.id) !== String(id)));
        await refetchLoadedProjects();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the project.');
        logger.error('projects.restore.error', error);
        return false;
      }
    },
    [setGlobalError, refetchLoadedProjects],
  );

  // Permanently deletes a TRASHED project (irreversible). Returns true on success.
  const deleteProjectPermanently = useCallback(
    async (id) => {
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
    [setGlobalError],
  );

  // Enables public sharing: the server mints (or returns) the project's stable
  // share token, mirrored locally. Returns the token, or null on failure.
  const enableSharing = useCallback(
    async (projectId) => {
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
    [setGlobalError],
  );

  // Disables public sharing: the link dies immediately server-side.
  const disableSharing = useCallback(
    async (projectId) => {
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
    [setGlobalError],
  );

  // Duplicates a project (norms + palette copied server-side) and prepends the
  // copy to the local list. Returns the new project on success, or null.
  const duplicateProject = useCallback(
    async (id) => {
      try {
        const newProject = await api.post(
          `/projects/${id}/duplicate`,
          {},
          { onGlobalError: setGlobalError },
        );
        setProjects((prevProjects) => [newProject, ...prevProjects]);
        updatePagination({ ...paginationRef.current, total: paginationRef.current.total + 1 });
        return newProject;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to duplicate the project.');
        logger.error('projects.duplicate.error', error);
        return null;
      }
    },
    [setGlobalError, updatePagination],
  );

  // Pins a project to the top of the dashboard. Moves it locally to just after
  // the other pinned projects, mirroring the server's append-to-end-of-pin-order
  // behavior, so the dashboard's pinned section doesn't jump around on refetch.
  const pinProject = useCallback(
    async (projectId) => {
      try {
        await api.post(`/projects/${projectId}/pin`, {}, { onGlobalError: setGlobalError });
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
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to pin the project.');
        logger.error('projects.pin.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Unpins a project; it naturally falls back into the "Your projects" section
  // wherever it lands next time the grid is refetched.
  const unpinProject = useCallback(
    async (projectId) => {
      try {
        await api.delete(`/projects/${projectId}/pin`, null, { onGlobalError: setGlobalError });
        setProjects((prev) =>
          prev.map((project) =>
            String(project.id) === String(projectId) ? { ...project, pinned: false } : project,
          ),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to unpin the project.');
        logger.error('projects.unpin.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Reorders the user's pinned projects. Only bumps the request server-side;
  // the caller (the dashboard's drag hook) owns the optimistic local order.
  const reorderPinnedProjects = useCallback(
    async (orderedIds) => {
      try {
        await api.post('/projects/pinned/reorder', orderedIds, { onGlobalError: setGlobalError });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to reorder the pinned projects.');
        logger.error('projects.reorderPinned.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Moves a project to the trash (soft delete server-side) and removes it from
  // the grid, clearing the active id if it matched. The trash list is refreshed
  // silently so the dashboard's trash section stays accurate. Returns true on
  // success, false on failure.
  const deleteProject = useCallback(
    async (id) => {
      try {
        await api.delete(`/projects/${id}`, null, { onGlobalError: setGlobalError });
        setProjects((prevProjects) =>
          prevProjects.filter((project) => String(project.id) !== String(id)),
        );
        updatePagination({
          ...paginationRef.current,
          total: Math.max(0, paginationRef.current.total - 1),
        });
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
    [activeProjectId, setGlobalError, updatePagination, fetchTrashedProjects],
  );

  // Replaces the whole palette and adopts the canonical one returned by the
  // server (ids + persisted order). Used for every palette change: add, edit,
  // delete, reorder. Returns the saved palette, or null on failure.
  const updateProjectPalette = useCallback(
    async (projectId, palette) => {
      try {
        const response = await api.post(`/projects/${projectId}/palette`, palette, {
          onGlobalError: setGlobalError,
        });
        const savedPalette = response?.palette || [];
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? { ...project, palette: savedPalette }
              : project,
          ),
        );
        return savedPalette;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to update the palette.');
        logger.error('projects.updatePalette.error', error);
        return null;
      }
    },
    [setGlobalError],
  );

  // Fetches a project's trashed colors (small list: id, name, hex, days left).
  const fetchTrashedColors = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) {
        setTrashedPaletteColors([]);
        return [];
      }
      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects/${projectId}/palette/trash`, options);
        const fetched = data?.colors || [];
        setTrashedPaletteColors(fetched);
        return fetched;
      } catch (error) {
        logger.error('projects.fetchTrashedColors.error', error);
        return [];
      }
    },
    [setGlobalError],
  );

  // Moves a single color to the trash (soft delete server-side) and removes it
  // locally. Distinct from updateProjectPalette (bulk replace): this is what the
  // palette editor's "Delete" button calls, so a deletion is always
  // independently restorable. The trash list is refreshed silently so the
  // page's trash section stays accurate. Returns true on success.
  const deleteColor = useCallback(
    async (projectId, colorId) => {
      try {
        await api.delete(`/projects/${projectId}/palette/${colorId}`, null, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  palette: (project.palette || []).filter(
                    (color) => String(color.id) !== String(colorId),
                  ),
                }
              : project,
          ),
        );
        fetchTrashedColors(projectId, { silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the color.');
        logger.error('projects.deleteColor.error', error);
        return false;
      }
    },
    [setGlobalError, fetchTrashedColors],
  );

  // Restores a trashed color, appending it back to the project's local palette
  // using the data already held in the trash list. Returns true on success.
  const restoreColor = useCallback(
    async (projectId, colorId) => {
      try {
        await api.post(
          `/projects/${projectId}/palette/${colorId}/restore`,
          {},
          { onGlobalError: setGlobalError },
        );
        const restored = trashedPaletteColors.find((color) => String(color.id) === String(colorId));
        setTrashedPaletteColors((prev) =>
          prev.filter((color) => String(color.id) !== String(colorId)),
        );
        if (restored) {
          setProjects((prevProjects) =>
            prevProjects.map((project) =>
              String(project.id) === String(projectId)
                ? {
                    ...project,
                    palette: [
                      ...(project.palette || []),
                      { id: restored.id, name: restored.name, hex: restored.hex },
                    ],
                  }
                : project,
            ),
          );
        }
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the color.');
        logger.error('projects.restoreColor.error', error);
        return false;
      }
    },
    [trashedPaletteColors, setGlobalError],
  );

  // Permanently deletes a TRASHED color (irreversible). Returns true on success.
  const deleteColorPermanently = useCallback(
    async (projectId, colorId) => {
      try {
        await api.delete(`/projects/${projectId}/palette/${colorId}/permanent`, null, {
          onGlobalError: setGlobalError,
        });
        setTrashedPaletteColors((prev) =>
          prev.filter((color) => String(color.id) !== String(colorId)),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the color.');
        logger.error('projects.deleteColorPermanently.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Renames a project and locally marks it as just edited. Returns true on
  // success, false on failure.
  const updateProjectName = useCallback(
    async (projectId, { name }) => {
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
    [setGlobalError],
  );

  // Adds a brush norm using the server-assigned id; keeps normsCount in sync.
  const addBrushNorm = useCallback(
    async (projectId, norm) => {
      try {
        const data = await api.post(`/projects/${projectId}/brush-norms`, norm, {
          onGlobalError: setGlobalError,
        });
        const normWithId = { ...norm, id: data.id };
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  brushNorms: [...(project.brushNorms || []), normWithId],
                  normsCount: (project.normsCount || 0) + 1,
                }
              : project,
          ),
        );
        return normWithId;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to add the standard.');
        logger.error('projects.addBrushNorm.error', error);
        return null;
      }
    },
    [setGlobalError],
  );

  // Adds a typography norm using the server-assigned id; bumps normsCount.
  const addTypographyNorm = useCallback(
    async (projectId, norm) => {
      try {
        const data = await api.post(`/projects/${projectId}/typography-norms`, norm, {
          onGlobalError: setGlobalError,
        });
        const normWithId = { ...norm, id: data.id };
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  typographyNorms: [...(project.typographyNorms || []), normWithId],
                  normsCount: (project.normsCount || 0) + 1,
                }
              : project,
          ),
        );
        return normWithId;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to add the standard.');
        logger.error('projects.addTypographyNorm.error', error);
        return null;
      }
    },
    [setGlobalError],
  );

  // Fetches a project's trashed brush norms (small list, with days left).
  const fetchTrashedBrushNorms = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) {
        setTrashedBrushNorms([]);
        return [];
      }
      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects/${projectId}/brush-norms/trash`, options);
        const fetched = data?.norms || [];
        setTrashedBrushNorms(fetched);
        return fetched;
      } catch (error) {
        logger.error('projects.fetchTrashedBrushNorms.error', error);
        return [];
      }
    },
    [setGlobalError],
  );

  // Fetches a project's trashed typography norms (small list, with days left).
  const fetchTrashedTypographyNorms = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) {
        setTrashedTypographyNorms([]);
        return [];
      }
      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects/${projectId}/typography-norms/trash`, options);
        const fetched = data?.norms || [];
        setTrashedTypographyNorms(fetched);
        return fetched;
      } catch (error) {
        logger.error('projects.fetchTrashedTypographyNorms.error', error);
        return [];
      }
    },
    [setGlobalError],
  );

  /** Moves a brush norm to the trash (soft delete) and decrements normsCount.
      The trash list is refreshed silently so the page's trash section stays accurate. */
  const deleteBrushNorm = useCallback(
    async (projectId, normId) => {
      try {
        const normIdNum = Number(normId);
        await api.delete(`/projects/${projectId}/brush-norms/${normIdNum}`, null, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  brushNorms: project.brushNorms.filter((norm) => Number(norm.id) !== normIdNum),
                  normsCount: (project.normsCount || 0) - 1,
                }
              : project,
          ),
        );
        fetchTrashedBrushNorms(projectId, { silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error('projects.deleteBrushNorm.error', error);
        return false;
      }
    },
    [setGlobalError, fetchTrashedBrushNorms],
  );

  /** Moves a typography norm to the trash (soft delete) and decrements normsCount. */
  const deleteTypographyNorm = useCallback(
    async (projectId, normId) => {
      try {
        const normIdNum = Number(normId);
        await api.delete(`/projects/${projectId}/typography-norms/${normIdNum}`, null, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  typographyNorms: project.typographyNorms.filter(
                    (norm) => Number(norm.id) !== normIdNum,
                  ),
                  normsCount: (project.normsCount || 0) - 1,
                }
              : project,
          ),
        );
        fetchTrashedTypographyNorms(projectId, { silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error('projects.deleteTypographyNorm.error', error);
        return false;
      }
    },
    [setGlobalError, fetchTrashedTypographyNorms],
  );

  // Restores a trashed brush norm, appending it back to the project's local
  // standards using the data already held in the trash list, and bumps
  // normsCount. Returns true on success.
  const restoreBrushNorm = useCallback(
    async (projectId, normId) => {
      try {
        await api.post(
          `/projects/${projectId}/brush-norms/${normId}/restore`,
          {},
          { onGlobalError: setGlobalError },
        );
        const restored = trashedBrushNorms.find((norm) => String(norm.id) === String(normId));
        setTrashedBrushNorms((prev) => prev.filter((norm) => String(norm.id) !== String(normId)));
        if (restored) {
          setProjects((prevProjects) =>
            prevProjects.map((project) =>
              String(project.id) === String(projectId)
                ? {
                    ...project,
                    brushNorms: [...(project.brushNorms || []), restored],
                    normsCount: (project.normsCount || 0) + 1,
                  }
                : project,
            ),
          );
        }
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the standard.');
        logger.error('projects.restoreBrushNorm.error', error);
        return false;
      }
    },
    [trashedBrushNorms, setGlobalError],
  );

  // Restores a trashed typography norm the same way as restoreBrushNorm.
  const restoreTypographyNorm = useCallback(
    async (projectId, normId) => {
      try {
        await api.post(
          `/projects/${projectId}/typography-norms/${normId}/restore`,
          {},
          { onGlobalError: setGlobalError },
        );
        const restored = trashedTypographyNorms.find((norm) => String(norm.id) === String(normId));
        setTrashedTypographyNorms((prev) =>
          prev.filter((norm) => String(norm.id) !== String(normId)),
        );
        if (restored) {
          setProjects((prevProjects) =>
            prevProjects.map((project) =>
              String(project.id) === String(projectId)
                ? {
                    ...project,
                    typographyNorms: [...(project.typographyNorms || []), restored],
                    normsCount: (project.normsCount || 0) + 1,
                  }
                : project,
            ),
          );
        }
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the standard.');
        logger.error('projects.restoreTypographyNorm.error', error);
        return false;
      }
    },
    [trashedTypographyNorms, setGlobalError],
  );

  // Permanently deletes a TRASHED brush norm (irreversible). Returns true on success.
  const deleteBrushNormPermanently = useCallback(
    async (projectId, normId) => {
      try {
        await api.delete(`/projects/${projectId}/brush-norms/${normId}/permanent`, null, {
          onGlobalError: setGlobalError,
        });
        setTrashedBrushNorms((prev) => prev.filter((norm) => String(norm.id) !== String(normId)));
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error('projects.deleteBrushNormPermanently.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Permanently deletes a TRASHED typography norm (irreversible). Returns true on success.
  const deleteTypographyNormPermanently = useCallback(
    async (projectId, normId) => {
      try {
        await api.delete(`/projects/${projectId}/typography-norms/${normId}/permanent`, null, {
          onGlobalError: setGlobalError,
        });
        setTrashedTypographyNorms((prev) =>
          prev.filter((norm) => String(norm.id) !== String(normId)),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error('projects.deleteTypographyNormPermanently.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  /** Updates fields of an existing brush norm, merging `updates` locally. */
  const updateBrushNorm = useCallback(
    async (projectId, normId, updates) => {
      try {
        await api.put(`/projects/${projectId}/brush-norms/${normId}`, updates, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  brushNorms: project.brushNorms.map((norm) =>
                    Number(norm.id) === Number(normId) ? { ...norm, ...updates } : norm,
                  ),
                }
              : project,
          ),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to update the standard.');
        logger.error('projects.updateBrushNorm.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  /** Updates fields of an existing typography norm, merging `updates` locally. */
  const updateTypographyNorm = useCallback(
    async (projectId, normId, updates) => {
      try {
        await api.put(`/projects/${projectId}/typography-norms/${normId}`, updates, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  typographyNorms: project.typographyNorms.map((norm) =>
                    Number(norm.id) === Number(normId) ? { ...norm, ...updates } : norm,
                  ),
                }
              : project,
          ),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to update the standard.');
        logger.error('projects.updateTypographyNorm.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Reorders a project's brush standards. Only bumps the request server-side;
  // the caller (the drag hook) owns the optimistic local order.
  const reorderBrushNorms = useCallback(
    async (projectId, orderedIds) => {
      try {
        await api.post(`/projects/${projectId}/brush-norms/reorder`, orderedIds, {
          onGlobalError: setGlobalError,
        });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to reorder the standards.');
        logger.error('projects.reorderBrushNorms.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Reorders a project's typography standards, same contract as reorderBrushNorms.
  const reorderTypographyNorms = useCallback(
    async (projectId, orderedIds) => {
      try {
        await api.post(`/projects/${projectId}/typography-norms/reorder`, orderedIds, {
          onGlobalError: setGlobalError,
        });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to reorder the standards.');
        logger.error('projects.reorderTypographyNorms.error', error);
        return false;
      }
    },
    [setGlobalError],
  );

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(
    () => ({
      projects,
      projectsPagination,
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
