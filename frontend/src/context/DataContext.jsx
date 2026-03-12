// Contexte global pour l'etat et les appels API.
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api, { setToken as setApiToken, clearToken as clearApiToken } from '../services/api';

export const DataContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const DataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('frameset_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser?.token) {
        setApiToken(parsedUser.token);
        api.get('/user/profile')
          .then(profile => {
            setUser(parsedUser);
            fetchProjects(parsedUser.id, { silent: true });
            setLoading(false);
          })
          .catch((err) => {
            setUser(null);
            clearApiToken();
            localStorage.removeItem('frameset_user');
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const setAuthenticatedUser = (userData) => {
    if (!userData) return;
    setUser(userData);
    if (userData?.token) setApiToken(userData.token);
    localStorage.setItem('frameset_user', JSON.stringify(userData));
    if (userData.id) fetchProjects(userData.id);
  };

  // Supprimer une norme de trait
  const deleteBrushNorm = async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      await api.delete(`/projects/${projectId}/brush-norms/${normIdNum}`, { onGlobalError: setGlobalError });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          brushNorms: p.brushNorms.filter(n => Number(n.id) !== normIdNum),
          normsCount: (p.normsCount || 0) - 1
        } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la suppression de la norme.');
      console.error(e);
    }
  };

  // Supprimer une norme typographique
  const deleteTypographyNorm = async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      await api.delete(`/projects/${projectId}/typography-norms/${normIdNum}`, { onGlobalError: setGlobalError });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          typographyNorms: p.typographyNorms.filter(n => Number(n.id) !== normIdNum),
          normsCount: (p.normsCount || 0) - 1
        } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la suppression de la norme.');
      console.error(e);
    }
  };

  const fetchProjects = async (userId, { silent = false } = {}) => {
    try {
      const options = silent ? undefined : { onGlobalError: setGlobalError };
      const data = await api.get(`/projects?userId=${userId}`, options);
      setProjects(data || []);
    } catch (error) {
      console.error('Échec du chargement des projets', error);
    } finally {
      setLoading(false);
    }
  };

  // Mettre a jour une norme de trait
  const updateBrushNorm = async (projectId, normId, updates) => {
    try {
      await api.put(`/projects/${projectId}/brush-norms/${normId}`, updates, { onGlobalError: setGlobalError });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          brushNorms: p.brushNorms.map(n => Number(n.id) === Number(normId) ? { ...n, ...updates } : n)
        } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la modification de la norme.');
      console.error(e);
    }
  };

  // Mettre a jour une norme typographique
  const updateTypographyNorm = async (projectId, normId, updates) => {
    try {
      await api.put(`/projects/${projectId}/typography-norms/${normId}`, updates, { onGlobalError: setGlobalError });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          typographyNorms: p.typographyNorms.map(n => Number(n.id) === Number(normId) ? { ...n, ...updates } : n)
        } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la modification de la norme.');
      console.error(e);
    }
  };

  const login = async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      if (userData?.token) setApiToken(userData.token);
      setUser(userData);
      localStorage.setItem('frameset_user', JSON.stringify(userData));
      fetchProjects(userData.id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.data?.error || err.message };
    }
  };

  const register = async (userData) => {
    try {
      const newUser = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      if (newUser?.token) {
        setApiToken(newUser.token);
        setUser(newUser);
        localStorage.setItem('frameset_user', JSON.stringify(newUser));
      }
      setProjects([]);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.data?.error || err.message };
    }
  };

  const logout = () => {
    setUser(null);
    setProjects([]);
    localStorage.removeItem('frameset_user');
    clearApiToken();
  };

  const applyUserUpdate = (userData) => {
    if (!userData) return;
    setUser(userData);
    localStorage.setItem('frameset_user', JSON.stringify(userData));
  };

  const activeProject = useMemo(() => 
    projects.find(p => String(p.id) === String(activeProjectId)) || null
  , [projects, activeProjectId]);

  const addProject = async (name) => {
    if (!user) return;
    try {
      const newProject = await api.post('/projects', { userId: user.id, name }, { onGlobalError: setGlobalError });
      setProjects(prev => [newProject, ...prev]);
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de l’ajout du projet.');
      console.error(e);
    }
  };

  const deleteProject = async (id) => {
    try {
      await api.delete(`/projects/${id}`, { onGlobalError: setGlobalError });
      setProjects(prev => prev.filter(p => String(p.id) !== String(id)));
      if (String(activeProjectId) === String(id)) setActiveProjectId(null);
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la suppression du projet.');
      console.error(e);
    }
  };

  const updateProjectPalette = async (projectId, palette) => {
    try {
      await api.post(`/projects/${projectId}/palette`, palette, { onGlobalError: setGlobalError });
      setProjects(prev => 
        prev.map(p => String(p.id) === String(projectId) ? { ...p, palette: palette } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la modification de la palette.');
      console.error(e);
    }
  };

  const updateProjectName = async (projectId, { name }) => {
    try {
      await api.put(`/projects/${projectId}`, { name }, { onGlobalError: setGlobalError });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? { ...p, name, lastEdited: "À l'instant" } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors du changement de nom du projet.');
      console.error(e);
    }
  };

  const deleteProjectPaletteColor = async (projectId, colorHex) => {
    try {
      await api.delete(`/projects/${projectId}/palette`, { hex: colorHex }, { onGlobalError: setGlobalError });
      setProjects(prev => 
        prev.map(p => String(p.id) === String(projectId) ? { 
          ...p, 
          palette: p.palette.filter(c => c.hex !== colorHex) 
        } : p)
      );
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la suppression de la couleur.');
      console.error(e);
    }
  };

  // Ajouter une norme de trait
  const addBrushNorm = async (projectId, norm) => {
    try {
      const data = await api.post(`/projects/${projectId}/brush-norms`, norm, { onGlobalError: setGlobalError });
      const normWithId = { ...norm, id: data.id };
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          brushNorms: [...(p.brushNorms || []), normWithId],
          normsCount: (p.normsCount || 0) + 1
        } : p)
      );
      return normWithId;
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de l’ajout de la norme.');
      console.error(e);
    }
  };

  // Ajouter une norme typographique
  const addTypographyNorm = async (projectId, norm) => {
    try {
      const data = await api.post(`/projects/${projectId}/typography-norms`, norm, { onGlobalError: setGlobalError });
      const normWithId = { ...norm, id: data.id };
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          typographyNorms: [...(p.typographyNorms || []), normWithId],
          normsCount: (p.normsCount || 0) + 1
        } : p)
      );
      return normWithId;
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de l’ajout de la norme.');
      console.error(e);
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) return;
    try {
      const data = await api.put('/user', { id: user.id, ...updates }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        name: data.name ?? user.name,
        email: data.email ?? user.email,
        pendingEmail: data.pendingEmail ?? user.pendingEmail
      };
      setUser(updatedUser);
      localStorage.setItem('frameset_user', JSON.stringify(updatedUser));
    } catch (e) {
      setGlobalError(e?.message || 'Erreur lors de la mise à jour du profil.');
      console.error(e);
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!user) return { success: false, message: 'Utilisateur non connecté.' };
    try {
      const data = await api.post('/user/password', { id: user.id, currentPassword, newPassword }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        passwordUpdatedAt: data.passwordUpdatedAt || new Date().toISOString()
      };
      setUser(updatedUser);
      localStorage.setItem('frameset_user', JSON.stringify(updatedUser));
      return { success: true };
    } catch (e) {
      console.error(e);
      const isBusinessError = e.status && e.status < 500;
      return { success: false, message: isBusinessError ? (e.data?.error || e.message) : undefined };
    }
  };

  return (
    <DataContext.Provider value={{
      user,
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      addProject,
      deleteProject,
      updateProjectPalette,
      updateProjectName,
      deleteProjectPaletteColor,
      addBrushNorm,
      addTypographyNorm,
      deleteBrushNorm,
      deleteTypographyNorm,
      updateBrushNorm,
      updateTypographyNorm,
      updateUserProfile,
      changePassword,
      applyUserUpdate,
      setAuthenticatedUser,
      loading,
      login,
      register,
      logout,
      globalError,
      setGlobalError
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData doit etre utilise dans un DataProvider');
  }
  return context;
};