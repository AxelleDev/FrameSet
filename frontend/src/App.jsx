/**
 * Root application component and route configuration.
 *
 * Wires up the global provider stack (AuthProvider then ProjectProvider so
 * project data can depend on the authenticated user) and declares every client
 * route via a HashRouter. HashRouter is used so the app works on static hosting
 * without server-side rewrite rules.
 *
 * Route map:
 *   /              -> redirects to /login
 *   /login         -> Login page
 *   /register      -> Register page
 *   /verify        -> email verification (signup or pending email change)
 *   /app           -> authenticated shell (MainLayout)
 *     dashboard    -> project list
 *     profile      -> user profile
 *     project/:id  -> per-project section, wrapped in an ErrorBoundary
 *       norms      -> graphic norms (brush + typography)
 *       palette    -> color palette
 *       export     -> PDF / JSON export
 *   *              -> NotFound (404)
 */
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

/**
 * Renders the global error banner and the full route tree. Kept separate from
 * <App /> so it can consume the auth context (it must live inside AuthProvider).
 */
function AppRoutes() {
  const { globalError, setGlobalError } = useAuth();
  return (
    <>
      {/* App-wide error alert fed by the auth context's globalError state */}
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

/**
 * Top-level component. Establishes the provider hierarchy that the rest of the
 * app depends on (auth first, then projects).
 */
export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppRoutes />
      </ProjectProvider>
    </AuthProvider>
  );
}