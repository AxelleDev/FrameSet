import React from 'react';
import GlobalErrorAlert from './components/GlobalErrorAlert';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import ProjectNorms from './pages/ProjectNorms';
import ProjectPalette from './pages/ProjectPalette';
import ProjectExport from './pages/ProjectExport';
import Profile from './pages/Profile';
import Verify from './pages/Verify';
import NotFound from './pages/NotFound';

function AppRoutes() {
  const { globalError, setGlobalError } = useAuth();
  return (
    <>
      <GlobalErrorAlert
        message={globalError}
        onClose={() => setGlobalError && setGlobalError(null)}
      />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/app" element={<MainLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route
              path="project/:id"
              element={(
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
              )}
            >
               <Route index element={<Navigate to="norms" replace />} />
               <Route path="norms" element={<ProjectNorms />} />
               <Route path="palette" element={<ProjectPalette />} />
               <Route path="export" element={<ProjectExport />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppRoutes />
      </ProjectProvider>
    </AuthProvider>
  );
}