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
import React, { Suspense, lazy } from 'react';
import GlobalErrorAlert from './components/GlobalErrorAlert';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './layouts/MainLayout';

// Pages are code-split via React.lazy so each route's JS (and heavy deps like
// jsPDF / react-select) is only downloaded when that route is first visited.
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectNorms = lazy(() => import('./pages/ProjectNorms'));
const ProjectPalette = lazy(() => import('./pages/ProjectPalette'));
const ProjectExport = lazy(() => import('./pages/ProjectExport'));
const Profile = lazy(() => import('./pages/Profile'));
const Verify = lazy(() => import('./pages/Verify'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Spinner shown while a lazily-loaded route chunk is being fetched. */
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <div className="border-4 border-blue border-t-pink rounded-full w-10 h-10 animate-spin"></div>
    </div>
  );
}

/** Redirects users who are already signed in away from the public auth pages. */
function RedirectIfAuthenticated({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <RouteFallback />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return children;
}

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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
          <Route path="/register" element={<RedirectIfAuthenticated><Register /></RedirectIfAuthenticated>} />
          <Route path="/forgot-password" element={<RedirectIfAuthenticated><ForgotPassword /></RedirectIfAuthenticated>} />
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
        </Suspense>
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