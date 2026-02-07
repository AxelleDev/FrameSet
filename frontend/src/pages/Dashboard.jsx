import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, projects, addProject, deleteProject, setActiveProjectId } = useData();
  const navigate = useNavigate();

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

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
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 mb-12 animate-fade-in border border-white/60">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-20%] right-[-5%] w-96 h-96 bg-purple-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
           <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 bg-pink-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
           <div className="absolute top-[20%] left-[30%] w-72 h-72 bg-violet-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-start justify-between">
          <div>
            <h2 className="text-slate-800 text-3xl md:text-4xl font-light mb-4 tracking-tight">Bonjour, {user.name.split(' ')[0]}.</h2>
            <p className="text-slate-600 max-w-lg leading-relaxed font-medium">
               Vous avez actuellement <strong className="text-slate-900">{projects.length} projet{projects.length > 1 ? 's' : ''} actif{projects.length > 1 ? 's' : ''}</strong>.
            </p>
            <div className="mt-8 flex space-x-4">
               <button onClick={() => setIsCreatingProject(true)} className="px-6 py-3 bg-white/60 backdrop-blur-md border border-white/40 text-slate-900 rounded-xl hover:bg-white transition-all font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transform duration-200 cursor-pointer">
                 + Créer un projet
               </button>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-6 mt-6 md:mt-0">
             <div className="glass-panel p-4 rounded-2xl w-32 text-center bg-white/40 border-white/40 shadow-sm backdrop-blur-md">
                <div className="text-2xl font-bold text-slate-800">{totalNorms}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">Normes</div>
             </div>
             <div className="glass-panel p-4 rounded-2xl w-32 text-center bg-white/40 border-white/40 shadow-sm backdrop-blur-md">
                <div className="text-2xl font-bold text-purple-600">{projects.length}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">Projets</div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-6">
        <h3 className="text-xl font-medium text-slate-800">Projets Actifs</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} onClick={() => openProject(project.id)} className="group glass-card relative rounded-2xl p-6 cursor-pointer hover:bg-white/80 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-lavender-500/10 overflow-hidden">
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-lavender-100 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            
            {/* Delete Button */}
            <button 
                onClick={(e) => handleDeleteProject(e, project.id)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/40 hover:bg-red-500 backdrop-blur-md rounded-full text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 hover:scale-110 shadow-sm"
                title="Supprimer le projet">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>

            <div className="relative z-10 flex flex-col h-full min-h-[160px]">
              {/* Spacer removed, added padding-right to title to avoid delete button overlap */}
              <h3 className="text-xl font-semibold text-slate-800 mt-2 mb-1 group-hover:text-lavender-600 transition-colors pr-8">{project.name}</h3>
              <p className="text-sm text-slate-400 mb-auto">Modifié {project.lastEdited}</p>

              <div className="mt-8 pt-4 border-t border-slate-100 flex -space-x-2 min-h-[40px] items-center">
                 {project.palette.map((color) => (
                    <div key={color.hex} className="w-6 h-6 rounded-full border border-white shadow-sm ring-1 ring-black/5" 
                         style={{ backgroundColor: color.hex }} 
                         title={color.name}></div>
                 ))}
                 {project.palette.length === 0 && (
                   <div className="text-xs text-slate-300 italic flex items-center">
                     <div className="w-6 h-6 rounded-full bg-slate-100 border border-white mr-1"></div>
                     <div className="w-6 h-6 rounded-full bg-slate-50 border border-white"></div>
                   </div>
                 )}
              </div>

              {/* Boutons accès direct */}
              <div className="flex gap-2 mt-4">
                <button onClick={(e) => { e.stopPropagation(); navigate(`/app/project/${project.id}/norms`); }} className="px-3 py-1 bg-lavender-100 text-lavender-700 rounded-lg text-xs font-medium hover:bg-lavender-200 transition">Normes</button>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/app/project/${project.id}/palette`); }} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-lg text-xs font-medium hover:bg-pink-200 transition">Palette</button>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/app/project/${project.id}/export`); }} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition">Export</button>
              </div>
            </div>
          </div>
        ))}

        <div onClick={() => setIsCreatingProject(true)} className="group rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 cursor-pointer hover:border-lavender-400 hover:bg-lavender-50/50 transition-all min-h-[200px]">
           <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-lavender-100 group-hover:text-lavender-600 transition-colors mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
           </div>
           <span className="text-sm font-medium text-slate-500">Nouveau Projet</span>
        </div>
      </div>

      {isCreatingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-white/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-lavender-100 rounded-full -mr-16 -mt-16 opacity-50"></div>

             <h3 className="text-xl font-light text-slate-900 mb-6 relative z-10">Nouveau Projet</h3>

             <div className="space-y-4 relative z-10">
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nom du projet</label>
                   <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="ex: Neo-Tokyo Editorial" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lavender-400 focus:bg-white transition-all text-slate-800" autoFocus />
                </div>
             </div>

             <div className="flex gap-3 mt-8 relative z-10">
               <button onClick={() => setIsCreatingProject(false)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">
                 Annuler
               </button>
               <button onClick={handleCreateProject} disabled={!newProjectName}
                       className="flex-1 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                 Créer
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}