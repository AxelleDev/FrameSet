import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const DataContext = createContext(null);

const API_URL = 'http://localhost:3000/api';

export const DataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check localStorage for persisted user on load
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

  const activeProject = useMemo(() => 
    projects.find(p => String(p.id) === String(activeProjectId)) || null
  , [projects, activeProjectId]);

  const addProject = async (name, client = 'Interne') => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name, client })
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
        prev.map(p => String(p.id) === String(projectId) ? { ...p, palette: [...p.palette, ...palette] } : p)
      );
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

  const addProjectNorm = async (projectId, norm) => {
    try {
      await fetch(`${API_URL}/projects/${projectId}/norms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(norm)
      });
       setProjects(prev => 
        prev.map(p => String(p.id) === String(projectId) ? { 
          ...p, 
          norms: [...p.norms, norm],
          normsCount: p.normsCount + 1 
        } : p)
      );
    } catch (e) { console.error(e); }
  };

  const updateUserProfile = async (updates) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, ...updates })
      });
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('frameset_user', JSON.stringify(updatedUser));
    } catch (e) { console.error(e); }
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
      deleteProjectPaletteColor,
      addProjectNorm,
      updateUserProfile,
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