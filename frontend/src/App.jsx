/**
 * Root component and route tree. Provider order (Auth then Project) lets project
 * data depend on the authenticated user. SPA fallback rewrites (vercel.json /
 * public/_redirects) serve index.html so clean URLs work on static hosting.
 */
import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { getFriendlyMessage } from './utils/friendlyError';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './layouts/MainLayout';

// Pages are code-split via React.lazy so each route's JS (and heavy deps like
// jsPDF / react-select) is only downloaded when that route is first visited.
const Landing = lazy(() => import('./pages/Landing'));
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
      <div className="border-4 border-blue/20 border-t-blue rounded-full w-10 h-10 animate-spin"></div>
    </div>
  );
}

// On route change (but not initial load, so autofocus / native scroll restore
// still work), scroll to top and focus the main content region (or the <h1>) so
// keyboard and screen-reader users land at the top of the new page.
function RouteFocus() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render: let initial autofocus / native scroll happen.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    try {
      window.scrollTo(0, 0);
    } catch {
      // scrollTo is a no-op in some test environments (jsdom); ignore.
    }

    // Prefer the app shell's main content region, then fall back to the page's
    // first heading so public pages (which have no #content) still get focus.
    const target = document.getElementById('content') || document.querySelector('h1');
    if (!target) return;

    // Make non-interactive targets focusable just for this programmatic focus,
    // then release the temporary tabindex so they stay out of the tab order.
    const hadTabIndex = target.hasAttribute('tabindex');
    if (!hadTabIndex) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (!hadTabIndex) {
      const release = () => {
        target.removeAttribute('tabindex');
        target.removeEventListener('blur', release);
      };
      target.addEventListener('blur', release);
    }
  }, [pathname]);

  return null;
}

/** Redirects users who are already signed in away from the public auth pages. */
function RedirectIfAuthenticated({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <RouteFallback />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return children;
}

// Route tree. Separate from <App /> so it can live inside AuthProvider and
// surface global auth errors as a toast (same feedback used everywhere else).
function AppRoutes() {
  const { globalError, setGlobalError } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!globalError) return;
    showToast(getFriendlyMessage(globalError), 'danger');
    setGlobalError(null);
  }, [globalError, showToast, setGlobalError]);

  return (
    <>
      <BrowserRouter>
        <RouteFocus />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Landing />} />
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
      </BrowserRouter>
    </>
  );
}

// Establishes the provider hierarchy (auth first, then projects).
export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ProjectProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ProjectProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}