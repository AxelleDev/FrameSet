/**
 * Project data context provider.
 *
 * Holds the authenticated user's projects and the currently active project, and
 * exposes CRUD actions for projects plus their palette colors, brush norms and
 * typography norms. All mutations call the API and then optimistically update
 * local state so the UI stays in sync without a refetch; failures are surfaced
 * through the auth context's global error banner.
 *
 * Exposed via useProjects():
 *   State:   projects, activeProjectId, activeProject, projectsLoading
 *   Setters: setActiveProjectId
 *   Actions: fetchProjects, addProject, deleteProject, updateProjectName,
 *            updateProjectPalette, addBrushNorm, addTypographyNorm,
 *            deleteBrushNorm, deleteTypographyNorm, updateBrushNorm,
 *            updateTypographyNorm
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

export const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const { user, authLoading, setGlobalError } = useAuth();

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  /**
   * Fetches the current user's projects into state.
   * @param {{ silent?: boolean }} [opts] When silent, suppress the global error banner.
   * @returns {Promise<Array>} The fetched projects (empty array if none/failed).
   */
  const fetchProjects = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) {
      setProjects([]);
      setProjectsLoading(false);
      return [];
    }

    setProjectsLoading(true);

    try {
      const options = silent ? undefined : { onGlobalError: setGlobalError };
      const data = await api.get('/projects', options);
      const nextProjects = data || [];
      setProjects(nextProjects);
      return nextProjects;
    } catch (error) {
      logger.error('projects.fetch.error', error);
      return [];
    } finally {
      setProjectsLoading(false);
    }
  }, [user?.id, setGlobalError]);

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

  /** Creates a project and prepends it to the local list. */
  const addProject = useCallback(async (name) => {
    if (!user) return;

    try {
      const newProject = await api.post('/projects', { name }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => [newProject, ...prevProjects]);
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de l\'ajout du projet.');
      logger.error('projects.add.error', error);
    }
  }, [user, setGlobalError]);

  /** Deletes a project and removes it locally, clearing the active id if it matched. */
  const deleteProject = useCallback(async (id) => {
    try {
      await api.delete(`/projects/${id}`, null, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => prevProjects.filter((project) => String(project.id) !== String(id)));
      if (String(activeProjectId) === String(id)) {
        setActiveProjectId(null);
      }
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la suppression du projet.');
      logger.error('projects.delete.error', error);
    }
  }, [activeProjectId, setGlobalError]);

  /**
   * Replaces a project's whole palette with the given ordered array of colors
   * and adopts the canonical palette returned by the server (each color carries
   * its id and persisted order). Used for every palette change: add, edit,
   * delete and reorder.
   * @returns {Promise<Array|null>} The saved palette on success, or null on failure.
   */
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
      setGlobalError(error?.message || 'Erreur lors de la modification de la palette.');
      logger.error('projects.updatePalette.error', error);
      return null;
    }
  }, [setGlobalError]);

  /** Renames a project and locally marks it as just edited. */
  const updateProjectName = useCallback(async (projectId, { name }) => {
    try {
      await api.patch(`/projects/${projectId}`, { name }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? { ...project, name, lastEdited: "À l'instant" }
            : project
        ))
      ));
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors du changement de nom du projet.');
      logger.error('projects.updateName.error', error);
    }
  }, [setGlobalError]);

  /**
   * Adds a brush norm. Uses the server-assigned id and keeps normsCount in sync.
   * @returns {Promise<object|null>} The created norm (with id), or null on failure.
   */
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
      setGlobalError(error?.message || 'Erreur lors de l\'ajout de la norme.');
      logger.error('projects.addBrushNorm.error', error);
      return null;
    }
  }, [setGlobalError]);

  /**
   * Adds a typography norm. Uses the server-assigned id and bumps normsCount.
   * @returns {Promise<object|null>} The created norm (with id), or null on failure.
   */
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
      setGlobalError(error?.message || 'Erreur lors de l\'ajout de la norme.');
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la suppression de la norme.');
      logger.error('projects.deleteBrushNorm.error', error);
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la suppression de la norme.');
      logger.error('projects.deleteTypographyNorm.error', error);
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la modification de la norme.');
      logger.error('projects.updateBrushNorm.error', error);
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la modification de la norme.');
      logger.error('projects.updateTypographyNorm.error', error);
    }
  }, [setGlobalError]);

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(() => ({
    projects,
    activeProjectId,
    activeProject,
    projectsLoading,
    setActiveProjectId,
    fetchProjects,
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
    activeProjectId,
    activeProject,
    projectsLoading,
    fetchProjects,
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

/**
 * Accessor hook for the project context. Throws if used outside a ProjectProvider.
 * @returns The project context value (state + actions).
 */
export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects doit etre utilise dans un ProjectProvider');
  }
  return context;
};
