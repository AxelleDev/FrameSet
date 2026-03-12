import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const { user, authLoading, setGlobalError } = useAuth();

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const fetchProjects = useCallback(async (userId = user?.id, { silent = false } = {}) => {
    if (!userId) {
      setProjects([]);
      setProjectsLoading(false);
      return [];
    }

    setProjectsLoading(true);

    try {
      const options = silent ? undefined : { onGlobalError: setGlobalError };
      const data = await api.get(`/projects?userId=${userId}`, options);
      const nextProjects = data || [];
      setProjects(nextProjects);
      return nextProjects;
    } catch (error) {
      console.error('Echec du chargement des projets', error);
      return [];
    } finally {
      setProjectsLoading(false);
    }
  }, [user?.id, setGlobalError]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setProjects([]);
      setActiveProjectId(null);
      setProjectsLoading(false);
      return;
    }

    fetchProjects(user.id, { silent: true });
  }, [authLoading, user?.id, fetchProjects]);

  const activeProject = useMemo(() => (
    projects.find((project) => String(project.id) === String(activeProjectId)) || null
  ), [projects, activeProjectId]);

  const addProject = useCallback(async (name) => {
    if (!user) return;

    try {
      const newProject = await api.post('/projects', { userId: user.id, name }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => [newProject, ...prevProjects]);
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de l\'ajout du projet.');
      console.error(error);
    }
  }, [user, setGlobalError]);

  const deleteProject = useCallback(async (id) => {
    try {
      await api.delete(`/projects/${id}`, null, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => prevProjects.filter((project) => String(project.id) !== String(id)));
      if (String(activeProjectId) === String(id)) {
        setActiveProjectId(null);
      }
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la suppression du projet.');
      console.error(error);
    }
  }, [activeProjectId, setGlobalError]);

  const updateProjectPalette = useCallback(async (projectId, palette) => {
    try {
      await api.post(`/projects/${projectId}/palette`, palette, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId) ? { ...project, palette } : project
        ))
      ));
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la modification de la palette.');
      console.error(error);
    }
  }, [setGlobalError]);

  const updateProjectName = useCallback(async (projectId, { name }) => {
    try {
      await api.patch(`/projects/${projectId}`, { name }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? { ...project, name, lastEdited: "A l'instant" }
            : project
        ))
      ));
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors du changement de nom du projet.');
      console.error(error);
    }
  }, [setGlobalError]);

  const deleteProjectPaletteColor = useCallback(async (projectId, colorHex) => {
    try {
      await api.delete(`/projects/${projectId}/palette`, { hex: colorHex }, { onGlobalError: setGlobalError });
      setProjects((prevProjects) => (
        prevProjects.map((project) => (
          String(project.id) === String(projectId)
            ? { ...project, palette: project.palette.filter((color) => color.hex !== colorHex) }
            : project
        ))
      ));
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la suppression de la couleur.');
      console.error(error);
    }
  }, [setGlobalError]);

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
      console.error(error);
      return null;
    }
  }, [setGlobalError]);

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
      console.error(error);
      return null;
    }
  }, [setGlobalError]);

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
      console.error(error);
    }
  }, [setGlobalError]);

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
      console.error(error);
    }
  }, [setGlobalError]);

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
      console.error(error);
    }
  }, [setGlobalError]);

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
      console.error(error);
    }
  }, [setGlobalError]);

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
    deleteProjectPaletteColor,
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
    deleteProjectPaletteColor,
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

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects doit etre utilise dans un ProjectProvider');
  }
  return context;
};
