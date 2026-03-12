import { useCallback } from 'react';
import { useProjects } from '../context/ProjectContext';

export const useProjectApi = () => {
  const projects = useProjects();

  const fetchProjects = useCallback((...args) => projects.fetchProjects(...args), [projects]);
  const addProject = useCallback((...args) => projects.addProject(...args), [projects]);
  const deleteProject = useCallback((...args) => projects.deleteProject(...args), [projects]);
  const updateProject = useCallback((...args) => projects.updateProjectName(...args), [projects]);
  const updatePalette = useCallback((...args) => projects.updateProjectPalette(...args), [projects]);
  const deletePaletteColor = useCallback((...args) => projects.deleteProjectPaletteColor(...args), [projects]);

  const addBrushNorm = useCallback((...args) => projects.addBrushNorm(...args), [projects]);
  const addTypographyNorm = useCallback((...args) => projects.addTypographyNorm(...args), [projects]);
  const deleteBrushNorm = useCallback((...args) => projects.deleteBrushNorm(...args), [projects]);
  const deleteTypographyNorm = useCallback((...args) => projects.deleteTypographyNorm(...args), [projects]);
  const updateBrushNorm = useCallback((...args) => projects.updateBrushNorm(...args), [projects]);
  const updateTypographyNorm = useCallback((...args) => projects.updateTypographyNorm(...args), [projects]);

  return {
    fetchProjects,
    addProject,
    deleteProject,
    updateProject,
    updatePalette,
    deletePaletteColor,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  };
};

export default useProjectApi;
