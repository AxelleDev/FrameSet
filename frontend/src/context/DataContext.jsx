import React, { createContext, useContext, useMemo } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ProjectProvider, useProjects } from './ProjectContext';

export const DataContext = createContext(null);

const DataBridge = ({ children }) => {
  const auth = useAuth();
  const projects = useProjects();

  const value = useMemo(() => ({
    user: auth.user,
    projects: projects.projects,
    activeProjectId: projects.activeProjectId,
    activeProject: projects.activeProject,
    setActiveProjectId: projects.setActiveProjectId,
    fetchProjects: projects.fetchProjects,
    addProject: projects.addProject,
    deleteProject: projects.deleteProject,
    updateProject: projects.updateProjectName,
    updateProjectName: projects.updateProjectName,
    updateProjectPalette: projects.updateProjectPalette,
    deleteProjectPaletteColor: projects.deleteProjectPaletteColor,
    addBrushNorm: projects.addBrushNorm,
    addTypographyNorm: projects.addTypographyNorm,
    deleteBrushNorm: projects.deleteBrushNorm,
    deleteTypographyNorm: projects.deleteTypographyNorm,
    updateBrushNorm: projects.updateBrushNorm,
    updateTypographyNorm: projects.updateTypographyNorm,
    updateUserProfile: auth.updateUserProfile,
    changePassword: auth.changePassword,
    applyUserUpdate: auth.applyUserUpdate,
    setAuthenticatedUser: auth.setAuthenticatedUser,
    login: auth.login,
    register: auth.register,
    logout: auth.logout,
    globalError: auth.globalError,
    setGlobalError: auth.setGlobalError,
    authLoading: auth.authLoading,
    projectsLoading: projects.projectsLoading,
    loading: auth.authLoading || projects.projectsLoading
  }), [auth, projects]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const DataProvider = ({ children }) => (
  <AuthProvider>
    <ProjectProvider>
      <DataBridge>{children}</DataBridge>
    </ProjectProvider>
  </AuthProvider>
);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData doit etre utilise dans un DataProvider');
  }
  return context;
};