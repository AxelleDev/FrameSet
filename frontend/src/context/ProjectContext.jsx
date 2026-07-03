/**
 * Project context: holds the user's projects and the active project, exposing
 * CRUD for projects, palette and norms via useProjects(). Mutations optimistically
 * update local state (no refetch); failures go to the global error banner.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  // Monotonic token to discard out-of-order responses: two interleaved fetches
  // (silent page-1 on login + a "load more", or a StrictMode double-mount) must
  // not let a stale response overwrite the newer list/pagination.
  const fetchSeq = useRef(0);

  // Fetches a page of projects. Page 1 replaces the list; later pages are
  // appended and de-duplicated by id (so an insertion between fetches can't
  // produce duplicate React keys). silent suppresses the global error banner.
  const fetchProjects = useCallback(async ({ silent = false, page = 1 } = {}) => {
    if (!user?.id) {
      setProjects([]);
      updatePagination(DEFAULT_PAGINATION);
      setProjectsLoading(false);
      return [];
    }

    const seq = (fetchSeq.current += 1);
    setProjectsLoading(true);

    try {
      const options = silent ? undefined : { onGlobalError: setGlobalError };
      const data = await api.get(`/projects?page=${page}`, options);
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
  }, [user?.id, setGlobalError, updatePagination]);

  /** Loads the next page of projects (appended), if any remain. */
  const loadMoreProjects = useCallback(() => {
    const { page, totalPages } = paginationRef.current;
    if (page >= totalPages) return;
    fetchProjects({ page: page + 1 });
  }, [fetchProjects]);

  // Load projects once auth has settled. Logging out (no user) clears state.
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setProjects([]);
      setActiveProjectId(null);
      setProjectsLoading(false);
      return;
    }

    fetchProjects({ silent: true });
  }, [authLoading, user?.id, fetchProjects]);

  // Resolve the active project object from its id. String() compares because
  // the route param is a string while project ids may be numbers.
  const activeProject = useMemo(() => (
    projects.find((project) => String(project.id) === String(activeProjectId)) || null
  ), [projects, activeProjectId]);

  // Creates a project and prepends it to the local list. Returns the created
  // project on success, or null on failure (so callers can gate toasts/modals).
  const addProject = useCallback(async (name) => {
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
  }, [user, setGlobalError, updatePagination]);

  // Deletes a project and removes it locally, clearing the active id if it
  // matched. Returns true on success, false on failure.
  const deleteProject = useCallback(async (id) => {
    try {
      await api.delete(`/projects/${id}`, null, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => prevProjects.filter((project) => String(project.id) !== String(id)));
      updatePagination({ ...paginationRef.current, total: Math.max(0, paginationRef.current.total - 1) });
      if (String(activeProjectId) === String(id)) {
        setActiveProjectId(null);
      }
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to delete the project.');
      logger.error('projects.delete.error', error);
      return false;
    }
  }, [activeProjectId, setGlobalError, updatePagination]);

  // Replaces the whole palette and adopts the canonical one returned by the
  // server (ids + persisted order). Used for every palette change: add, edit,
  // delete, reorder. Returns the saved palette, or null on failure.
  const updateProjectPalette = useCallback(async (projectId, palette) => {
    try {
      const response = await api.post(
        `/projects/${projectId}/palette`,
        palette,
        { onGlobalError: setGlobalError }
      );
      const savedPalette = response?.palette || [];
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId) ? { ...project, palette: savedPalette } : project
        ))
      ));
      return savedPalette;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to update the palette.');
      logger.error('projects.updatePalette.error', error);
      return null;
    }
  }, [setGlobalError]);

  // Renames a project and locally marks it as just edited. Returns true on
  // success, false on failure.
  const updateProjectName = useCallback(async (projectId, { name }) => {
    try {
      await api.patch(`/projects/${projectId}`, { name }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? { ...project, name, lastEdited: 'Just now' }
            : project
        ))
      ));
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to rename the project.');
      logger.error('projects.updateName.error', error);
      return false;
    }
  }, [setGlobalError]);

  // Adds a brush norm using the server-assigned id; keeps normsCount in sync.
  const addBrushNorm = useCallback(async (projectId, norm) => {
    try {
      const data = await api.post(`/projects/${projectId}/brush-norms`, norm, { onGlobalError: setGlobalError });
      const normWithId = { ...norm, id: data.id };
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              brushNorms: [...(project.brushNorms || []), normWithId],
              normsCount: (project.normsCount || 0) + 1
            }
            : project
        ))
      ));
      return normWithId;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to add the standard.');
      logger.error('projects.addBrushNorm.error', error);
      return null;
    }
  }, [setGlobalError]);

  // Adds a typography norm using the server-assigned id; bumps normsCount.
  const addTypographyNorm = useCallback(async (projectId, norm) => {
    try {
      const data = await api.post(`/projects/${projectId}/typography-norms`, norm, { onGlobalError: setGlobalError });
      const normWithId = { ...norm, id: data.id };
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              typographyNorms: [...(project.typographyNorms || []), normWithId],
              normsCount: (project.normsCount || 0) + 1
            }
            : project
        ))
      ));
      return normWithId;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to add the standard.');
      logger.error('projects.addTypographyNorm.error', error);
      return null;
    }
  }, [setGlobalError]);

  /** Deletes a brush norm by id and decrements normsCount. */
  const deleteBrushNorm = useCallback(async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      await api.delete(`/projects/${projectId}/brush-norms/${normIdNum}`, null, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              brushNorms: project.brushNorms.filter((norm) => Number(norm.id) !== normIdNum),
              normsCount: (project.normsCount || 0) - 1
            }
            : project
        ))
      ));
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to delete the standard.');
      logger.error('projects.deleteBrushNorm.error', error);
      return false;
    }
  }, [setGlobalError]);

  /** Deletes a typography norm by id and decrements normsCount. */
  const deleteTypographyNorm = useCallback(async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      await api.delete(`/projects/${projectId}/typography-norms/${normIdNum}`, null, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              typographyNorms: project.typographyNorms.filter((norm) => Number(norm.id) !== normIdNum),
              normsCount: (project.normsCount || 0) - 1
            }
            : project
        ))
      ));
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to delete the standard.');
      logger.error('projects.deleteTypographyNorm.error', error);
      return false;
    }
  }, [setGlobalError]);

  /** Updates fields of an existing brush norm, merging `updates` locally. */
  const updateBrushNorm = useCallback(async (projectId, normId, updates) => {
    try {
      await api.put(`/projects/${projectId}/brush-norms/${normId}`, updates, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              brushNorms: project.brushNorms.map((norm) => (
                Number(norm.id) === Number(normId) ? { ...norm, ...updates } : norm
              ))
            }
            : project
        ))
      ));
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to update the standard.');
      logger.error('projects.updateBrushNorm.error', error);
      return false;
    }
  }, [setGlobalError]);

  /** Updates fields of an existing typography norm, merging `updates` locally. */
  const updateTypographyNorm = useCallback(async (projectId, normId, updates) => {
    try {
      await api.put(`/projects/${projectId}/typography-norms/${normId}`, updates, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? {
              ...project,
              typographyNorms: project.typographyNorms.map((norm) => (
                Number(norm.id) === Number(normId) ? { ...norm, ...updates } : norm
              ))
            }
            : project
        ))
      ));
      return true;
    } catch (error) {
      setGlobalError(error?.message || 'Failed to update the standard.');
      logger.error('projects.updateTypographyNorm.error', error);
      return false;
    }
  }, [setGlobalError]);

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(() => ({
    projects,
    projectsPagination,
    activeProjectId,
    activeProject,
    projectsLoading,
    setActiveProjectId,
    fetchProjects,
    loadMoreProjects,
    addProject,
    deleteProject,
    updateProjectName,
    updateProjectPalette,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  }), [
    projects,
    projectsPagination,
    activeProjectId,
    activeProject,
    projectsLoading,
    fetchProjects,
    loadMoreProjects,
    addProject,
    deleteProject,
    updateProjectName,
    updateProjectPalette,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

// Accessor hook for the project context. Throws if used outside a ProjectProvider.
export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
