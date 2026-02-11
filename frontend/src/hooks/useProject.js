import { useCallback } from 'react';
import { useData } from '../context/DataContext';

export const useProjectApi = () => {
  const data = useData();
  const fetchProjects = useCallback((userId) => data && data.fetchProjects ? data.fetchProjects(userId) : null, [data]);
  const addProject = useCallback((...args) => data.addProject(...args), [data]);
  const deleteProject = useCallback((...args) => data.deleteProject(...args), [data]);
  const updateProject = useCallback((...args) => data.updateProject ? data.updateProject(...args) : data.updateProjectName(...args), [data]);
  const updatePalette = useCallback((...args) => data.updateProjectPalette(...args), [data]);
  const deletePaletteColor = useCallback((...args) => data.deleteProjectPaletteColor(...args), [data]);

  const addBrushNorm = useCallback((...args) => data.addBrushNorm(...args), [data]);
  const addTypographyNorm = useCallback((...args) => data.addTypographyNorm(...args), [data]);
  const deleteBrushNorm = useCallback((...args) => data.deleteBrushNorm(...args), [data]);
  const deleteTypographyNorm = useCallback((...args) => data.deleteTypographyNorm(...args), [data]);
  const updateBrushNorm = useCallback((...args) => data.updateBrushNorm(...args), [data]);
  const updateTypographyNorm = useCallback((...args) => data.updateTypographyNorm(...args), [data]);

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
