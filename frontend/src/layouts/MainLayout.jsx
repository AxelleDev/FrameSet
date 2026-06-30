// Main application layout.
import React, { useState } from 'react';
import { Outlet, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import Avatar from '../components/Avatar';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import Seo from '../components/Seo';

/**
 * Authenticated application shell: collapsible sidebar navigation, top header
 * with breadcrumb/title, and the routed page content via <Outlet />. Waits for
 * auth/projects to load and redirects unauthenticated users to /login.
 */
export default function MainLayout() {
  const { user, authLoading } = useAuth();
  const { activeProject, projectsLoading } = useProjects();
  // Combined loading flag while either auth or projects are still resolving.
  const loading = authLoading || projectsLoading;
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Compute NavLink classes based on the active route state.
  const navLinkClass = ({ isActive }) =>
    `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-base ${
      isActive ? 'bg-blue/15 text-blue' : 'text-primary hover:text-blue hover:bg-blue/10'
    }`;

  // Derive the header title from the active project or the current route.
  const getPageTitle = () => {
    if (activeProject) return activeProject.name;
    if (location.pathname.includes('profile')) return 'Mon Profil';
    return 'Tableau de bord';
  };

  // Show a loading state until auth/projects resolve.
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-canvas" role="status" aria-live="polite">
        <div className="border-4 border-blue/20 border-t-blue rounded-full w-10 h-10 animate-spin"></div>
        <p className="mt-4 text-primary/60">Chargement…</p>
      </div>
    );
  }
  // Redirect unauthenticated users to the login page.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-canvas text-primary transition-colors duration-slow">
      <Seo title="Espace de travail" noindex />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-toast focus:px-4 focus:py-2 focus:rounded-xl focus:bg-surface focus:text-primary focus:ring-2 focus:ring-blue"
      >
        Aller au contenu
      </a>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-overlay bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={closeMobileMenu}
        ></button>
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-drawer flex flex-col w-72 m-4 rounded-3xl bg-surface overflow-hidden transition-transform duration-slow ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}
      `}>
        <div className="p-8 flex items-center justify-between">
            <div className="flex justify-center w-full">
              <Logo className="w-[65%] h-auto object-contain" style={{ maxWidth: '260px' }} />
            </div>
            <button onClick={closeMobileMenu} className="md:hidden text-secondary hover:text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          <div className="mb-8">
            <p className="px-4 text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">Espace de travail</p>
            <NavLink to="/app/dashboard" className={navLinkClass} onClick={closeMobileMenu}>
              <svg className="mr-3 h-5 w-5 text-blue group-hover:text-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Tableau de bord
            </NavLink>
          </div>

          {activeProject && (
            <div className="animate-fade-in">
              <p className="px-4 text-[10px] font-bold text-secondary uppercase tracking-widest mb-4 truncate" title={activeProject.name}>
                Projet actif
              </p>
              
              <div className="space-y-1">
                <NavLink to={`/app/project/${activeProject.id}/norms`} className={navLinkClass} onClick={closeMobileMenu}>
                   <svg className="mr-3 h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                   Normes graphiques
                </NavLink>
                <NavLink to={`/app/project/${activeProject.id}/palette`} className={navLinkClass} onClick={closeMobileMenu}>
                   <svg className="mr-3 h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                   Palette
                </NavLink>
                <NavLink to={`/app/project/${activeProject.id}/export`} className={navLinkClass} onClick={closeMobileMenu}>
                   <svg className="mr-3 h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                   Export
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        <NavLink
          to="/app/profile"
          onClick={closeMobileMenu}
          className={({ isActive }) => `p-4 transition cursor-pointer group ${isActive ? 'bg-blue/15' : 'hover:bg-blue/10'}`}
        >
          {({ isActive }) => (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Avatar initials={user.avatarInitials} className="h-9 w-9 text-xs group-hover:scale-105 transition-transform" />
                <div className="ml-3">
                  <p className={`text-xs font-bold transition-colors ${isActive ? 'text-blue' : 'text-primary group-hover:text-blue'}`}>{user.name}</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-blue transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          )}
        </NavLink>
      </aside>

      <main className="flex-1 overflow-auto focus:outline-none relative custom-scrollbar">
        <header className="h-20 flex items-center justify-between px-8 sticky top-0 z-sticky bg-canvas/90 backdrop-blur-md md:bg-transparent md:backdrop-blur-0 transition-all duration-slow">
          <div className="flex items-center">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mr-4 text-primary hover:text-blue transition-colors p-2 -ml-2 rounded-lg hover:bg-blue/10">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>

             {activeProject ? (
               <nav aria-label="Fil d'Ariane" className="flex text-sm font-medium items-center animate-fade-in">
                 <Link className="text-blue hover:text-primary transition cursor-pointer" to="/app/dashboard">Espace de travail</Link>
                 <svg className="w-4 h-4 mx-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                 <span className="text-primary bg-blue/15 px-2.5 py-1 rounded-lg truncate max-w-[150px] md:max-w-none">{activeProject.name}</span>
               </nav>
             ) : (
               <span className="text-xl font-light text-primary">
                 {getPageTitle()}
               </span>
             )}
          </div>

          <ThemeToggle />
        </header>

        <div id="contenu" tabIndex={-1} className="p-4 md:p-8 max-w-7xl mx-auto pb-24 outline-none">
          <Outlet />
        </div>
      </main>
    </div>
  );
}