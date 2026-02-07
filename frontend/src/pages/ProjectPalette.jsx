import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useParams } from 'react-router-dom';

export default function ProjectPalette() {
  const { id } = useParams();
  const { setActiveProjectId, activeProject, updateProjectPalette, deleteProjectPaletteColor } = useData();
  
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const openAddModal = () => {
    setNewColorName('');
    setNewColorHex('#');
    setIsAddingColor(true);
  };

  const isValidHex = () => {
    const hex = newColorHex.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex.startsWith('#') ? hex : '#' + hex);
  };

  const confirmAddColor = () => {
    if (!id || !newColorName || !newColorHex) return;

    let hex = newColorHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;

    updateProjectPalette(id, [{
      name: newColorName,
      hex: hex
    }]);

    setIsAddingColor(false);
  };

  const handleDeleteColor = (e, colorHex) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (confirm('Supprimer cette couleur ?')) {
      deleteProjectPaletteColor(id, colorHex);
    }
  };

  const copyToClipboard = (hex) => {
    navigator.clipboard.writeText(hex);
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-light text-primary">Palette de Couleurs</h2>
          <p className="text-primary mt-2">Ensemble des couleurs de référence à utiliser pour ce projet.</p>
        </div>
      </div>

      {activeProject && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <button onClick={openAddModal} className="aspect-[4/5] rounded-2xl border-2 border-dashed [border-color:var(--color-secondary)] flex flex-col items-center justify-center hover:![border-color:var(--color-blue)] hover:bg-pink/10 transition-all group">
             <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3 transition-transform group-hover:scale-110 group-hover:bg-blue/10 [color:var(--color-secondary)] group-hover:[color:var(--color-blue)]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
             </div>
             <span className="text-xs font-bold uppercase tracking-widest text-primary">Ajouter</span>
          </button>

          {activeProject.palette.map((color, i) => (
            <div key={color.hex + i} className="group relative flex flex-col aspect-[4/5] animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex-1 w-full rounded-[2rem] shadow-lg relative overflow-hidden transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-xl" 
                   style={{ backgroundColor: color.hex }}>
                   
                   <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50 pointer-events-none"></div>
                   

                   <button 
                      onClick={(e) => handleDeleteColor(e, color.hex)}
                      className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-red-500 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 hover:scale-110 shadow-sm"
                      title="Supprimer la couleur">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                   </button>

                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[2px] cursor-pointer z-10"
                        onClick={() => copyToClipboard(color.hex)}>
                      <span className="px-3 py-1 bg-white/90 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm transform scale-90 group-hover:scale-100 transition-transform">
                        Copier
                      </span>
                   </div>
              </div>
              
              <div className="mt-4 text-center">
                 <p className="text-sm font-semibold text-primary truncate" title={color.name}>{color.name}</p>
                 <p className="text-[10px] text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddingColor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border border-blue relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>

            <h3 className="text-xl font-light text-primary mb-6 relative z-10">Nouvelle Couleur</h3>
            
            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom de la couleur</label>
                  <input type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="ex: Reflet Cheveux" 
                    className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Code Hexadécimal</label>
                <div className="flex gap-3">
                   <div className="w-12 h-12 rounded-xl border border-blue shadow-inner flex-shrink-0" style={{ backgroundColor: isValidHex() ? newColorHex : '#ffffff' }}></div>
                   <input type="text" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} placeholder="ex: #FF5500" 
                          className="flex-1 px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary font-mono uppercase" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 relative z-10">
               <button onClick={() => setIsAddingColor(false)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
                 Annuler
               </button>
               <button onClick={confirmAddColor} disabled={!newColorName || !newColorHex}
                       className="flex-1 py-3 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                 Ajouter
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}