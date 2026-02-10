// Contexte global pour l'etat et les appels API.
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const DataContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const DataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('frameset_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchProjects(parsedUser.id);
    } else {
      setLoading(false);
    }
  }, []);

  // Delete brush norm
  const deleteBrushNorm = async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      const url = `${API_URL}/projects/${projectId}/brush-norms/${normIdNum}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          brushNorms: p.brushNorms.filter(n => Number(n.id) !== normIdNum),
          normsCount: (p.normsCount || 0) - 1
        } : p)
      );
    } catch (e) { console.error(e); }
  };

  // Delete typography norm
  const deleteTypographyNorm = async (projectId, normId) => {
    try {
      const normIdNum = Number(normId);
      const url = `${API_URL}/projects/${projectId}/typography-norms/${normIdNum}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      setProjects(prev =>
        prev.map(p => String(p.id) === String(projectId) ? {
          ...p,
          typographyNorms: p.typographyNorms.filter(n => Number(n.id) !== normIdNum),
          normsCount: (p.normsCount || 0) - 1
        } : p)
      );
    } catch (e) { console.error(e); }
  };

  const fetchProjects = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/projects?userId=${userId}`);
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

  // Update brush norm
  const updateBrushNorm = async (projectId, normId, updates) => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/brush-norms/${normId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setProjects(prev =>
          prev.map(p => String(p.id) === String(projectId) ? {
            ...p,
            brushNorms: p.brushNorms.map(n => Number(n.id) === Number(normId) ? { ...n, ...updates } : n)
          } : p)
        );
      }
    } catch (e) { console.error(e); }
  };

  // Update typography norm
  const updateTypographyNorm = async (projectId, normId, updates) => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/typography-norms/${normId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setProjects(prev =>
          prev.map(p => String(p.id) === String(projectId) ? {
            ...p,
            typographyNorms: p.typographyNorms.map(n => Number(n.id) === Number(normId) ? { ...n, ...updates } : n)
          } : p)
        );
      }
    } catch (e) { console.error(e); }
  };

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('frameset_user', JSON.stringify(userData));
      fetchProjects(userData.id);
      return { success: true };
    } else {
      const error = await res.json();
      return { success: false, message: error.error };
    }
  };

  const register = async (userData) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (res.ok) {
      const newUser = await res.json();
      setUser(newUser);
      localStorage.setItem('frameset_user', JSON.stringify(newUser));
      setProjects([]); // New user has no projects
      return { success: true };
    } else {
      const error = await res.json();
      return { success: false, message: error.error };
    }
  };

  const logout = () => {
    setUser(null);
    setProjects([]);
    localStorage.removeItem('frameset_user');
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
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name })
      });
      if (res.ok) {
        const newProject = await res.json();
        setProjects(prev => [newProject, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteProject = async (id) => {
    try {
      await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => String(p.id) !== String(id)));
      if (String(activeProjectId) === String(id)) setActiveProjectId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const updateProjectPalette = async (projectId, palette) => {
    try {
      await fetch(`${API_URL}/projects/${projectId}/palette`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(palette)
      });
      setProjects(prev => 
        prev.map(p => String(p.id) === String(projectId) ? { ...p, palette: palette } : p)
      );
    } catch (e) { console.error(e); }
  };

  const updateProjectName = async (projectId, name) => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setProjects(prev =>
          prev.map(p => String(p.id) === String(projectId) ? { ...p, name, lastEdited: "À l'instant" } : p)
        );
      }
    } catch (e) { console.error(e); }
  };

  const deleteProjectPaletteColor = async (projectId, colorHex) => {
    try {
      await fetch(`${API_URL}/projects/${projectId}/palette`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex: colorHex })
      });
      setProjects(prev => 
        prev.map(p => String(p.id) === String(projectId) ? { 
          ...p, 
          palette: p.palette.filter(c => c.hex !== colorHex) 
        } : p)
      );
    } catch (e) { console.error(e); }
  };

  // Add brush norm
  const addBrushNorm = async (projectId, norm) => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/brush-norms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(norm)
      });
      if (res.ok) {
        const data = await res.json();
        const normWithId = { ...norm, id: data.id };
        setProjects(prev =>
          prev.map(p => String(p.id) === String(projectId) ? {
            ...p,
            brushNorms: [...(p.brushNorms || []), normWithId],
            normsCount: (p.normsCount || 0) + 1
          } : p)
        );
        return normWithId;
      }
    } catch (e) { console.error(e); }
  };

  // Add typography norm
  const addTypographyNorm = async (projectId, norm) => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/typography-norms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(norm)
      });
      if (res.ok) {
        const data = await res.json();
        const normWithId = { ...norm, id: data.id };
        setProjects(prev =>
          prev.map(p => String(p.id) === String(projectId) ? {
            ...p,
            typographyNorms: [...(p.typographyNorms || []), normWithId],
            normsCount: (p.normsCount || 0) + 1
          } : p)
        );
        return normWithId;
      }
    } catch (e) { console.error(e); }
  };

  const updateUserProfile = async (updates) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, ...updates })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = {
          ...user,
          name: data.name ?? user.name,
          email: data.email ?? user.email,
          pendingEmail: data.pendingEmail ?? user.pendingEmail
        };
        setUser(updatedUser);
        localStorage.setItem('frameset_user', JSON.stringify(updatedUser));
      }
    } catch (e) { console.error(e); }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!user) return { success: false, message: 'Utilisateur non connecté.' };
    try {
      const res = await fetch(`${API_URL}/user/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, currentPassword, newPassword })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = {
          ...user,
          passwordUpdatedAt: data.passwordUpdatedAt || new Date().toISOString()
        };
        setUser(updatedUser);
        localStorage.setItem('frameset_user', JSON.stringify(updatedUser));
        return { success: true };
      }
      const error = await res.json();
      return { success: false, message: error.error };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Erreur réseau.' };
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
      loading,
      login,
      register,
      logout
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};