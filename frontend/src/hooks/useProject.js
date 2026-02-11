import api from '../services/api';
import { useCallback } from 'react';

// Hook regroupant les appels API liés aux projets et normes.
// Renvoie des fonctions memoïses pour être utilisées dans les composants.
export const useProjectApi = () => {
  const fetchProjects = useCallback((userId) => api.get(`/projects?userId=${userId}`), []);
  const addProject = useCallback((payload) => api.post('/projects', payload), []);
  const deleteProject = useCallback((id) => api.delete(`/projects/${id}`), []);
  const updateProject = useCallback((id, payload) => api.put(`/projects/${id}`, payload), []);
  const updatePalette = useCallback((projectId, palette) => api.post(`/projects/${projectId}/palette`, palette), []);
  const deletePaletteColor = useCallback((projectId, body) => api.delete(`/projects/${projectId}/palette`, body), []);

  // norms
  const addBrushNorm = useCallback((projectId, norm) => api.post(`/projects/${projectId}/brush-norms`, norm), []);
  const addTypographyNorm = useCallback((projectId, norm) => api.post(`/projects/${projectId}/typography-norms`, norm), []);
  const deleteBrushNorm = useCallback((projectId, id) => api.delete(`/projects/${projectId}/brush-norms/${id}`), []);
  const deleteTypographyNorm = useCallback((projectId, id) => api.delete(`/projects/${projectId}/typography-norms/${id}`), []);
  const updateBrushNorm = useCallback((projectId, id, body) => api.put(`/projects/${projectId}/brush-norms/${id}`, body), []);
  const updateTypographyNorm = useCallback((projectId, id, body) => api.put(`/projects/${projectId}/typography-norms/${id}`, body), []);

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
