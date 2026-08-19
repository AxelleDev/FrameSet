import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { getFriendlyMessage } from './utils/friendlyError';
import ErrorBoundary from './components/ErrorBoundary';
import CursorDot from './components/CursorDot';
import { captureException } from './utils/monitoring';
import MainLayout from './layouts/MainLayout';

// Prerendered routes (see scripts/prerender.mjs) are imported EAGERLY: the
// server-side renderToString can't await a lazy chunk, and an eager import
// also guarantees hydration never suspends on them. They are light,
// markup-heavy pages, so the main bundle barely grows.
import Landing from './pages/Landing';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Every other page stays code-split via React.lazy so each route's JS (and
// heavy deps like jsPDF / react-select) is only downloaded when that route is
// first visited.
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectNorms = lazy(() => import('./pages/ProjectNorms'));
const ProjectPalette = lazy(() => import('./pages/ProjectPalette'));
const ProjectExport = lazy(() => import('./pages/ProjectExport'));
const Profile = lazy(() => import('./pages/Profile'));
const Verify = lazy(() => import('./pages/Verify'));
const SharedProject = lazy(() => import('./pages/SharedProject'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Warm up the route chunks once the browser is idle after first paint, so
// navigating (or clicking a link) doesn't hit a visible "loading" swap. Failures
// are ignored — the chunk simply loads on demand as before.
function prefetchRouteChunks() {
  const prefetch = () => {
    [
      import('./pages/Login'),
      import('./pages/Register'),
      import('./pages/ForgotPassword'),
      import('./pages/Dashboard'),
      import('./pages/ProjectNorms'),
      import('./pages/ProjectPalette'),
      import('./pages/ProjectExport'),
      import('./pages/Profile'),
      import('./pages/Verify'),
      import('./pages/Terms'),
      import('./pages/Privacy'),
      import('./pages/SharedProject'),
      import('./pages/NotFound'),
    ].forEach((chunkPromise) => chunkPromise.catch(() => {}));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetch, { timeout: 3000 });
  } else {
    setTimeout(prefetch, 1500);
  }
}

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

  // One-time chunk warm-up so later navigation feels instant.
  useEffect(() => {
    prefetchRouteChunks();
  }, []);

  return (
    <BrowserRouter>
      <AppRouteTree />
    </BrowserRouter>
  );
}

// The routed UI without any router: shared verbatim by the browser entry
// (BrowserRouter, above) and the build-time prerenderer (StaticRouter, see
// src/entry-server.jsx), so the prerendered HTML and the hydrating client
// render exactly the same tree.
export function AppRouteTree() {
  return (
    <>
      {/* Site-wide decorative cursor follower (self-disables for touch and
          reduced-motion users — see the component). */}
      <CursorDot />
      <RouteFocus />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <RedirectIfAuthenticated>
                <ForgotPassword />
              </RedirectIfAuthenticated>
            }
          />
          <Route path="/verify" element={<Verify />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/s/:token" element={<SharedProject />} />
          <Route path="/app" element={<MainLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route
              path="project/:id"
              element={
                <ErrorBoundary onError={captureException}>
                  <Outlet />
                </ErrorBoundary>
              }
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
    </>
  );
}

// Establishes the provider hierarchy (auth first, then projects). Exported so
// the build-time prerenderer wraps the exact same providers around the tree.
export function AppProviders({ children }) {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ProjectProvider>
          <ToastProvider>{children}</ToastProvider>
        </ProjectProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
