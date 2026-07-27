// Main application layout.
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import Avatar from '../components/Avatar';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import Seo from '../components/Seo';
import Spinner from '../components/Spinner';
import SessionExpiryBanner from '../components/SessionExpiryBanner';
import DemoAccountBanner from '../components/DemoAccountBanner';
import OfflineBanner from '../components/OfflineBanner';
import GlobalSearch from '../components/GlobalSearch';
import { getHasUnsavedChanges } from '../utils/unsavedChangesStore';

/**
 * Authenticated application shell: collapsible sidebar navigation, top header
 * with breadcrumb/title, and the routed page content via <Outlet />. Waits for
 * auth/projects to load and redirects unauthenticated users to /login.
 */
export default function MainLayout() {
  const { user, authLoading } = useAuth();
  const { activeProject, projects, projectsLoading } = useProjects();
  // Block the whole shell only on auth or the FIRST projects load (empty list).
  // A later fetch (e.g. "Load more") must keep the page mounted — otherwise the
  // layout is replaced by a full-screen spinner, losing scroll position; those
  // fetches show their own inline spinner instead.
  const loading = authLoading || (projectsLoading && projects.length === 0);
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const asideRef = useRef(null);

  // Ctrl+K / Cmd+K opens the global search from anywhere in the app shell.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // beforeunload (useUnsavedChangesWarning) only fires on a real document
  // unload, never on client-side route changes — so in-app nav clicks (the
  // sidebar, the Workspace breadcrumb) need their own confirmation, checked
  // synchronously against whatever page is currently mounted and dirty.
  const guardNavigation = (e) => {
    if (
      getHasUnsavedChanges() &&
      !window.confirm('You have unsaved changes. Leave this page without saving?')
    ) {
      e.preventDefault();
      return;
    }
    closeMobileMenu();
  };

  // Always close the drawer when the route changes (defensive; nav items also close it).
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // While the mobile drawer is open, close it on Escape, trap Tab inside it (so
  // focus can't reach the content masked behind the overlay), and move focus into
  // it so keyboard/screen-reader users aren't left on the (now-obscured) trigger.
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !asideRef.current) return;
      const focusable = Array.from(
        asideRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    asideRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const navLinkClass = ({ isActive }) =>
    `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-base focus-ring ${
      isActive ? 'bg-blue/15 text-blue' : 'text-primary hover:text-blue hover:bg-blue/10'
    }`;

  const getPageTitle = () => {
    if (activeProject) return activeProject.name;
    if (location.pathname.includes('profile')) return 'Profile';
    return 'Dashboard';
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh bg-canvas"
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" className="text-blue" />
        <p className="mt-4 text-primary/60">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-dvh overflow-hidden bg-canvas text-primary transition-colors duration-slow">
      <Seo title="Workspace" noindex />
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-toast focus:px-4 focus:py-2 focus:rounded-xl focus:bg-surface focus:text-primary focus:ring-2 focus:ring-blue"
      >
        Skip to content
      </a>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-overlay bg-black/40 backdrop-blur-sm md:hidden animate-fade-in focus-ring"
          onClick={closeMobileMenu}
        ></button>
      )}

      <aside
        ref={asideRef}
        className={`
        fixed inset-y-0 left-0 z-drawer flex flex-col w-[min(18rem,calc(100vw-3rem))] md:w-72 m-4 rounded-3xl bg-surface overflow-hidden transition-transform duration-slow ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'visible translate-x-0' : 'invisible md:visible -translate-x-[calc(100%+2rem)]'}
      `}
      >
        {/* No close (×) button: the menu closes on backdrop tap or nav-item tap,
            staying consistent with the site's modals (none use a × either). */}
        <div className="p-8 flex justify-center">
          <Logo className="w-[65%] max-w-[260px] h-auto object-contain" />
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="mb-8">
            <p className="px-4 text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">
              Workspace
            </p>
            <NavLink to="/app/dashboard" className={navLinkClass} onClick={guardNavigation}>
              <svg
                className="mr-3 h-5 w-5 text-blue group-hover:text-blue transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Dashboard
            </NavLink>
          </div>

          {activeProject && (
            <div className="animate-fade-in">
              <p
                className="px-4 text-[10px] font-bold text-secondary uppercase tracking-widest mb-4 truncate"
                title={activeProject.name}
              >
                Active project
              </p>

              <div className="space-y-1">
                <NavLink
                  to={`/app/project/${activeProject.id}/norms`}
                  className={navLinkClass}
                  onClick={guardNavigation}
                >
                  <svg
                    className="mr-3 h-4 w-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Graphic standards
                </NavLink>
                <NavLink
                  to={`/app/project/${activeProject.id}/palette`}
                  className={navLinkClass}
                  onClick={guardNavigation}
                >
                  <svg
                    className="mr-3 h-4 w-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                  Palette
                </NavLink>
                <NavLink
                  to={`/app/project/${activeProject.id}/export`}
                  className={navLinkClass}
                  onClick={guardNavigation}
                >
                  <svg
                    className="mr-3 h-4 w-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Export
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        {/* Mobile only: on phones the theme switch moves out of the cramped
            header into the burger menu. On desktop it stays in the header. */}
        <div className="md:hidden flex items-center justify-between px-8 py-3 border-y border-blue/10">
          <span className="text-sm font-medium text-secondary">Theme</span>
          <ThemeToggle />
        </div>

        <NavLink
          to="/app/profile"
          onClick={guardNavigation}
          className={({ isActive }) =>
            `p-4 transition cursor-pointer group focus-ring ${isActive ? 'bg-blue/15' : 'hover:bg-blue/10'}`
          }
        >
          {({ isActive }) => (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Avatar
                  initials={user.avatarInitials}
                  className="h-9 w-9 text-xs group-hover:scale-105 transition-transform"
                />
                <div className="ml-3">
                  <p
                    className={`text-xs font-bold transition-colors ${isActive ? 'text-blue' : 'text-primary group-hover:text-blue'}`}
                  >
                    {user.name}
                  </p>
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-blue transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          )}
        </NavLink>
      </aside>

      <main className="flex-1 overflow-auto focus:outline-none relative">
        <header className="h-20 flex items-center gap-3 px-4 md:px-8 sticky top-0 z-sticky bg-canvas/90 backdrop-blur-md md:bg-transparent md:backdrop-blur-0 transition-all duration-slow">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className="md:hidden -ml-1 shrink-0 text-primary hover:text-blue transition-colors p-2 rounded-xl hover:bg-blue/10 focus-ring"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {activeProject ? (
            // The "Workspace" crumb is dropped on phones (the burger menu
            // already links there); only the project chip remains, truncating to fit.
            <nav
              aria-label="Breadcrumb"
              className="flex items-center text-sm font-medium min-w-0 animate-fade-in"
            >
              <Link
                className="hidden sm:inline whitespace-nowrap text-blue hover:text-primary transition cursor-pointer rounded focus-ring"
                to="/app/dashboard"
                onClick={guardNavigation}
              >
                Workspace
              </Link>
              <svg
                className="hidden sm:block w-4 h-4 mx-2 shrink-0 text-blue"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="min-w-0 truncate text-primary bg-blue/15 px-2.5 py-1 rounded-full">
                {activeProject.name}
              </span>
            </nav>
          ) : (
            <span className="min-w-0 truncate text-xl font-light text-primary">
              {getPageTitle()}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
              title="Search (Ctrl+K)"
              className="flex items-center gap-2 rounded-xl p-2 md:px-3 text-primary hover:text-blue hover:bg-blue/10 transition-colors focus-ring"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
                />
              </svg>
              <kbd className="hidden md:inline rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary/50">
                Ctrl K
              </kbd>
            </button>
            {/* Desktop only: the burger menu carries the theme switch on phones. */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div id="content" tabIndex={-1} className="p-4 md:p-8 max-w-7xl mx-auto pb-24 outline-none">
          <OfflineBanner />
          <DemoAccountBanner />
          <SessionExpiryBanner />
          <Outlet />
        </div>
      </main>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
