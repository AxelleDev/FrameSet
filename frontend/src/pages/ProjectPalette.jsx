import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useParams } from 'react-router-dom';
import AppModal from '../components/AppModal';

export default function ProjectPalette() {
  const { id } = useParams();
  const { setActiveProjectId, activeProject, updateProjectPalette, deleteProjectPaletteColor, user } = useData();

  const [editStatus, setEditStatus] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('');

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [palette, setPalette] = useState([]);
  const [previewPalette, setPreviewPalette] = useState([]);

  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleCopyHex = async (e, hex, idx) => {
    e.preventDefault();
    e.stopPropagation();
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(hex);
        success = true;
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = hex;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      success = false;
      console.error('Clipboard error:', err);
    }
    if (success) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1200);
    } else {
      alert('Erreur lors de la copie');
    }
  };

  useEffect(() => {
    if (activeProject && Array.isArray(activeProject.palette)) {
      setPalette(activeProject.palette);
      setPreviewPalette(activeProject.palette);
    }
  }, [activeProject]);
  
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const renderEditStatus = () => {
    if (editStatus === 'error') {
      return <div className="text-xs text-pink mt-2">Erreur lors de la modification.</div>;
    }
    if (editStatus === 'success') {
      return <div className="text-xs text-green-700 mt-2">Modification enregistrée.</div>;
    }
    return null;
  };

  const openEditModal = (idx) => {
    setEditIdx(idx);
    setEditColorName(palette[idx]?.name || '');
    setEditColorHex(palette[idx]?.hex || '#');
    setEditStatus(null);
  };

  const isValidEditHex = () => {
    const hex = editColorHex.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex.startsWith('#') ? hex : '#' + hex);
  };

  const openAddModal = () => {
    setNewColorName('');
    setNewColorHex('#');
    setIsAddingColor(true);
  };

  const isValidHex = () => {
    const hex = newColorHex.trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex.startsWith('#') ? hex : '#' + hex);
  };

  const confirmEditColor = async () => {
    if (editIdx === null || !editColorName || !editColorHex) return;
    let newHex = editColorHex.trim();
    if (!newHex.startsWith('#')) newHex = '#' + newHex;
    const oldHex = palette[editIdx].hex;
    try {
      const res = await fetch(`/api/projects/${id}/palette`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldHex, newName: editColorName, newHex })
      });
      if (res.ok) {
        setEditStatus('success');
        await syncPalette();
      } else {
        setEditStatus('error');
      }
    } catch (e) {
      setEditStatus('error');
    }
  };

  const confirmAddColor = async () => {
    if (!id || !newColorName || !newColorHex) return;
    let hex = newColorHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    const newPalette = [...palette, { name: newColorName, hex }];
    await updateProjectPalette(id, newPalette);
    setIsAddingColor(false);
    await syncPalette();
  };

  const handleDeleteColor = async (e, colorHex) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (window.confirm('Supprimer cette couleur ?')) {
      await deleteProjectPaletteColor(id, colorHex);
      await syncPalette();
    }
  };

  const syncPalette = async () => {
    if (user && user.id) {
      window.location.reload();
    }
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

          {(draggedIndex !== null && dragOverIndex !== null ? previewPalette : palette).map((color, idx) => (
            <div
              key={color.hex + '-' + idx}
              className={`group relative flex flex-col aspect-[4/5] animate-fade-in ${draggedIndex === idx ? 'opacity-60 scale-105 z-40' : ''} ${dragOverIndex === idx && draggedIndex !== null ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
              style={{ animationDelay: `${idx * 50}ms`, cursor: 'grab' }}
              draggable
              onDragStart={e => {
                setDraggedIndex(idx);
                setDragOverIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={e => {
                e.preventDefault();
                if (draggedIndex !== null && idx !== draggedIndex) {
                  setDragOverIndex(idx);
                  if (draggedIndex !== null) {
                    const tempPalette = [...palette];
                    const [moved] = tempPalette.splice(draggedIndex, 1);
                    tempPalette.splice(idx, 0, moved);
                    setPreviewPalette(tempPalette);
                  }
                }
              }}
              onDrop={e => {
                e.preventDefault();
                if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
                  const newPalette = [...palette];
                  const [moved] = newPalette.splice(draggedIndex, 1);
                  newPalette.splice(dragOverIndex, 0, moved);
                  setPalette(newPalette);
                  setPreviewPalette(newPalette);
                  setTimeout(() => {
                    updateProjectPalette(id, newPalette);
                  }, 200);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
                setPreviewPalette(palette);
              }}
            >
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

                    <button
                      onClick={() => openEditModal(idx)}
                      className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-[var(--color-blue)] backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 hover:scale-110 shadow-sm"
                      title="Modifier la couleur">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                      </svg>
                    </button>

                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[2px] cursor-pointer z-10"
                        onClick={e => handleCopyHex(e, color.hex, idx)}>
                      <span className="px-3 py-1 bg-white/90 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm transform scale-90 group-hover:scale-100 transition-transform">
                        {copiedIdx === idx ? 'Copié !' : 'Copier'}
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

      <AppModal
        isOpen={editIdx !== null}
        onClose={() => setEditIdx(null)}
        showClose={false}
        panelClassName="max-w-sm"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <h3 className="text-xl font-light text-primary mb-6 relative z-10">Modifier Couleur</h3>
        <div className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom de la couleur</label>
              <input type="text" value={editColorName} onChange={e => setEditColorName(e.target.value)} placeholder="ex: Reflet Cheveux" 
                className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Code Hexadécimal</label>
            <div className="flex gap-3">
               <div className="w-12 h-12 rounded-xl border border-blue shadow-inner flex-shrink-0" style={{ backgroundColor: isValidEditHex() ? editColorHex : '#ffffff' }}></div>
               <input type="text" value={editColorHex} onChange={e => setEditColorHex(e.target.value)} placeholder="ex: #FF5500" 
                      className="flex-1 px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary font-mono uppercase" />
            </div>
          </div>
          {renderEditStatus()}
        </div>
        <div className="flex gap-3 mt-8 relative z-10">
           <button onClick={() => setEditIdx(null)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
             Annuler
           </button>
           <button onClick={confirmEditColor} disabled={!editColorName || !editColorHex}
                   className="flex-1 py-3 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
             Confirmer
           </button>
        </div>
      </AppModal>

      <AppModal
        isOpen={isAddingColor}
        onClose={() => setIsAddingColor(false)}
        showClose={false}
        panelClassName="max-w-sm"
      >
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
      </AppModal>
    </>
  );
}