import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, projects, addProject, deleteProject, setActiveProjectId } = useData();
  const navigate = useNavigate();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
               <button onClick={() => setIsCreatingProject(true)} className="px-6 py-3 bg-blue text-white border border-primary rounded-xl hover:bg-pink transition-all font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transform duration-200 cursor-pointer">
                 + Créer un projet
               </button>

  useEffect(() => {
    setActiveProjectId(null);
  }, [setActiveProjectId]);

  const totalNorms = projects.reduce((acc, p) => acc + p.normsCount, 0);

  const handleCreateProject = () => {
    if (newProjectName && newProjectName.trim().length > 0) {
      addProject(newProjectName);
      setIsCreatingProject(false);
      setNewProjectName('');
    }
  };

  const openProject = (id) => {
    navigate(`/app/project/${id}/norms`);
  };

  const handleDeleteProject = (e, id) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
      deleteProject(id);
    }
  };

  return (
    <>
      <div className="relative rounded-3xl overflow-hidden bg-white mb-12 animate-fade-in border border-white">
          {/* Fond coloré supprimé pour un fond blanc pur */}

        <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-start justify-between">
          <div>
            <h2 className="text-primary text-3xl md:text-4xl font-light mb-4 tracking-tight">Bonjour, {user.name.split(' ')[0]}.</h2>
            <p className="text-primary max-w-lg leading-relaxed font-medium">
              Vous avez actuellement <strong className="text-blue">{projects.length} projet{projects.length > 1 ? 's' : ''} actif{projects.length > 1 ? 's' : ''}</strong>.
            </p>
            <div className="mt-8 flex space-x-4">
               <button onClick={() => setIsCreatingProject(true)} className="px-6 py-3 bg-blue/10 backdrop-blur-md border border-primary text-primary rounded-xl hover:bg-white transition-all font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transform duration-200 cursor-pointer">
                 + Créer un projet
               </button>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-6 mt-6 md:mt-0">
             <div className="p-4 rounded-2xl w-32 text-center" style={{ backgroundColor: 'rgba(137, 148, 223, 0.10)' }}>
                <div className="text-2xl font-bold text-primary">{totalNorms}</div>
                <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">Normes</div>
             </div>
             <div className="p-4 rounded-2xl w-32 text-center" style={{ backgroundColor: 'rgba(137, 148, 223, 0.10)' }}>
                <div className="text-2xl font-bold text-pink">{projects.length}</div>
                <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">Projets</div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-6">
        <h3 className="text-xl font-medium text-primary">Projets Actifs</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <>
          {projects.map((project) => (
            <div key={project.id} onClick={() => openProject(project.id)} className="group glass-card relative rounded-2xl p-6 cursor-pointer hover:bg-white/80 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-lavender-500/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-lavender-100 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              {/* Delete Button */}
              <button 
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/40 hover:bg-pink backdrop-blur-md rounded-full text-primary hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 hover:scale-110 shadow-sm"
                  title="Supprimer le projet">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </button>
              <div className="relative z-10 flex flex-col h-full min-h-[160px]">
                <h3 className="text-xl font-semibold text-primary mt-2 mb-1 group-hover:text-blue transition-colors pr-8">{project.name}</h3>
                <p className="text-sm text-primary mb-auto">Modifié {project.lastEdited}</p>
                <div className="mt-8 pt-4 border-t border-blue flex -space-x-2 min-h-[40px] items-center">
                  {project.palette.map((color) => (
                    <div key={color.hex} className="w-6 h-6 rounded-full border border-white shadow-sm ring-1 ring-black/5" 
                         style={{ backgroundColor: color.hex }} 
                         title={color.name}></div>
                  ))}
                  {project.palette.length === 0 && (
                    <div className="text-xs text-blue italic flex items-center">
                      <div className="w-6 h-6 rounded-full bg-blue/10 border border-white mr-1"></div>
                      <div className="w-6 h-6 rounded-full bg-blue/5 border border-white"></div>
                    </div>
                  )}
                </div>
                {/* Badges/boutons inutiles retirés */}
              </div>
            </div>
          ))}
          <div onClick={() => setIsCreatingProject(true)} className="group rounded-2xl border-2 border-dashed [border-color:var(--color-secondary)] flex flex-col items-center justify-center p-6 cursor-pointer hover:![border-color:var(--color-blue)] hover:bg-pink/10 transition-all min-h-[200px]">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center [color:var(--color-secondary)] group-hover:[color:var(--color-blue)] group-hover:bg-blue/10 transition-colors mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            </div>
            <span className="text-sm font-medium text-primary">Nouveau Projet</span>
          </div>
        </>
      </div>

      {isCreatingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue/20 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-blue relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>

             <h3 className="text-xl font-light text-primary mb-6 relative z-10">Nouveau Projet</h3>

             <div className="space-y-4 relative z-10">
               <div>
                 <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom du projet</label>
                 <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="ex: Neo-Tokyo Editorial" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" autoFocus />
               </div>
             </div>

             <div className="flex gap-3 mt-8 relative z-10">
              <button onClick={() => setIsCreatingProject(false)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
                Annuler
              </button>
              <button onClick={handleCreateProject} disabled={!newProjectName}
                    className="flex-1 py-3 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Créer
              </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}