import React, { useState } from 'react';
import { Outlet, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function MainLayout() {
  const { activeProject, user, loading } = useData();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navLinkClass = ({ isActive }) =>
    `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
      isActive ? 'bg-white/80 text-blue shadow-sm' : 'text-primary hover:text-pink hover:bg-white/50'
    }`;

  const getPageTitle = () => {
    if (activeProject) return activeProject.name;
    if (location.pathname.includes('profile')) return 'Mon Profil';
    return 'Tableau de bord';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-lg text-slate-500">Chargement...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#F8F9FF] text-primary transition-colors duration-500">
      
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-lavender-200/40 rounded-full blur-[100px] opacity-60"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] opacity-60"></div>
      </div>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={closeMobileMenu}
        ></div>
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-72 m-4 rounded-3xl glass-panel shadow-xl overflow-hidden transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}
      `}>
        <div className="p-8 border-b border-white/20 flex items-center justify-between">
            <div className="flex justify-center w-full">
              <img src="/FrameSet_Logo.png" alt="FrameSet Logo" className="w-[65%] h-auto object-contain" style={{ maxWidth: '260px' }} />
            </div>
            <button onClick={closeMobileMenu} className="md:hidden text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          <div className="mb-8">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Espace de Travail</p>
            <NavLink to="/app/dashboard" className={navLinkClass} onClick={closeMobileMenu}>
              <svg className="mr-3 h-5 w-5 text-blue group-hover:text-pink transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Tableau de bord
            </NavLink>
          </div>

          {activeProject && (
            <div className="animate-fade-in">
              <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 truncate" title={activeProject.name}>
                Projet Actif
              </p>
              
              <div className="space-y-1">
                <NavLink to={`/app/project/${activeProject.id}/norms`} className={navLinkClass} onClick={closeMobileMenu}>
                   <svg className="mr-3 h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                   Normes Graphiques
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

        <Link to="/app/profile" onClick={closeMobileMenu} className="p-4 border-t border-white/20 bg-white/30 hover:bg-white/50 transition cursor-pointer group">
           <div className="flex items-center justify-between mb-0">
              <div className="flex items-center">
                 <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue to-pink border-2 border-primary shadow-md flex items-center justify-center text-primary text-xs font-bold group-hover:scale-105 transition-transform">
                    {user.avatarInitials}
                 </div>
                 <div className="ml-3">
                   <p className="text-xs font-bold text-primary group-hover:text-blue transition-colors">{user.name}</p>
                 </div>
              </div>
              <svg className="w-4 h-4 text-blue group-hover:text-pink transition-colors opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
           </div>
        </Link>
      </aside>

      <main className="flex-1 overflow-auto focus:outline-none relative z-0 md:z-10 custom-scrollbar">
        <header className="h-20 flex items-center justify-between px-8 sticky top-0 z-50 bg-[#F8F9FF]/90 backdrop-blur-md border-b border-white/60 md:bg-transparent md:backdrop-blur-0 md:border-b-0 transition-all duration-300">
          <div className="flex items-center">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mr-4 text-primary hover:text-blue transition-colors p-2 -ml-2 rounded-lg hover:bg-white/50">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>

             {activeProject ? (
               <nav className="flex text-sm font-medium items-center animate-fade-in">
                 <Link className="text-blue hover:text-pink transition cursor-pointer" to="/app/dashboard">Espace de travail</Link>
                 <svg className="w-4 h-4 mx-2 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                 <span className="text-primary bg-white/50 px-2 py-1 rounded-md shadow-sm border border-primary truncate max-w-[150px] md:max-w-none">{activeProject.name}</span>
               </nav>
             ) : (
               <span className="text-xl font-light text-primary">
                 {getPageTitle()}
               </span>
             )}
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
}