import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useParams } from 'react-router-dom';
import AppModal from '../components/AppModal';
import ActionIconButton from '../components/ActionIconButton';

export default function ProjectNorms() {
  const { id } = useParams();
  const {
    setActiveProjectId,
    activeProject,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  } = useData();

  const [editingNorm, setEditingNorm] = useState(null);
  const [editingType, setEditingType] = useState('brush'); // 'brush' or 'typography'
  // Brush norm fields
  const [editBrushName, setEditBrushName] = useState('');
  const [editBrushUsage, setEditBrushUsage] = useState('');
  const [editBrushValue, setEditBrushValue] = useState('');
  const [editBrushUnit, setEditBrushUnit] = useState('px');
  // Typography norm fields
  const [editFontFamily, setEditFontFamily] = useState('');
  const [editFontWeight, setEditFontWeight] = useState('');
  const [editFontUsage, setEditFontUsage] = useState('');
  const [editFontStyle, setEditFontStyle] = useState('');

  const openEditNorm = (norm, type) => {
    setEditingNorm(norm);
    setEditingType(type);
    if (type === 'brush') {
      setEditBrushUsage(norm.name);
      setEditBrushName(norm.brushName);
      setEditBrushValue(norm.value);
      setEditBrushUnit(norm.unit || 'px');
    } else {
      setEditFontFamily(norm.fontFamily);
      setEditFontWeight(norm.fontWeight || '');
      setEditFontUsage(norm.fontUsage || '');
      setEditFontStyle(norm.fontStyle || '');
    }
  };

  const handleEditNorm = async () => {
    if (!id || !editingNorm) return;
    if (editingType === 'brush') {
      await updateBrushNorm(id, editingNorm.id, {
        name: editBrushUsage,
        value: editBrushValue,
        unit: editBrushUnit,
        brushName: editBrushName
      });
    } else {
      await updateTypographyNorm(id, editingNorm.id, {
        fontFamily: editFontFamily,
        fontWeight: editFontWeight,
        fontUsage: editFontUsage,
        fontStyle: editFontStyle
      });
    }
    setEditingNorm(null);
  };

  const [loadingDelete, setLoadingDelete] = useState(null);
  const handleDeleteNorm = async (e, normId, type) => {
    e.preventDefault();
    if (!id || !normId) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette norme ? Cette action est irréversible.')) return;
    setLoadingDelete(normId);
    if (type === 'brush') {
      await deleteBrushNorm(id, normId);
    } else {
      await deleteTypographyNorm(id, normId);
    }
    setLoadingDelete(null);
  };

  const [isAddingNorm, setIsAddingNorm] = useState(false);
  const [addType, setAddType] = useState('brush');
  // Add brush norm fields
  const [newBrushUsage, setNewBrushUsage] = useState('');
  const [newBrushName, setNewBrushName] = useState('');
  const [newBrushValue, setNewBrushValue] = useState('');
  const [newBrushUnit, setNewBrushUnit] = useState('px');
  // Add typography norm fields
  const [newFontFamily, setNewFontFamily] = useState('');
  const [newFontWeight, setNewFontWeight] = useState('');
  const [newFontUsage, setNewFontUsage] = useState('');
  const [newFontStyle, setNewFontStyle] = useState('');

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const resetForm = () => {
    setNewBrushUsage('');
    setNewBrushName('');
    setNewBrushValue('');
    setNewBrushUnit('px');
    setNewFontFamily('');
    setNewFontWeight('');
    setNewFontUsage('');
    setNewFontStyle('');
  };

  const handleAddNorm = async () => {
    if (!id) return;
    if (addType === 'brush') {
      if (!newBrushUsage || !newBrushValue) return;
      await addBrushNorm(id, {
        name: newBrushUsage,
        value: newBrushValue,
        unit: newBrushUnit,
        brushName: newBrushName
      });
    } else {
      if (!newFontFamily) return;
      await addTypographyNorm(id, {
        fontFamily: newFontFamily,
        fontWeight: newFontWeight,
        fontUsage: newFontUsage,
        fontStyle: newFontStyle
      });
    }
    setIsAddingNorm(false);
    resetForm();
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-light text-primary">Normes Graphiques</h2>
          <p className="text-primary mt-2 max-w-xl">Ensemble des règles techniques qui garantissent la cohérence visuelle.</p>
        </div>
      </div>

      {activeProject && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => { resetForm(); setAddType('brush'); setIsAddingNorm(true); }} className="rounded-2xl border-2 border-dashed [border-color:var(--color-secondary)] flex flex-col items-center justify-center hover:![border-color:var(--color-blue)] hover:bg-pink/10 transition-all group">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3 transition-transform group-hover:scale-110 group-hover:bg-blue/10 [color:var(--color-secondary)] group-hover:[color:var(--color-blue)]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Ajouter une norme</span>
            </button>
            {/* Brush Norms */}
            {activeProject.brushNorms && activeProject.brushNorms.map((norm) => (
              <div key={norm.id} className="glass-card p-6 rounded-2xl relative group hover:bg-white/80 transition-all hover:-translate-y-1 duration-300">
                <div className="absolute top-3 right-3 flex gap-2 z-30">
                  <ActionIconButton
                    onClick={() => openEditNorm(norm, 'brush')}
                    title="Modifier la norme"
                    intent="edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                    </svg>
                  </ActionIconButton>
                  <ActionIconButton
                    onClick={(e) => handleDeleteNorm(e, norm.id, 'brush')}
                    title="Supprimer la norme"
                    intent="delete"
                  >
                    {loadingDelete === norm.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </ActionIconButton>
                </div>
                <div className="flex justify-between items-start mb-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white border border-primary shadow-sm text-primary">Trait</span>
                </div>
                <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{norm.name}</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-light text-primary mr-1">{norm.value}</span>
                  <span className="text-lg text-blue font-medium">{norm.unit}</span>
                </div>
                <div className="h-16 bg-blue/10 rounded-xl flex items-center justify-center border border-primary relative overflow-hidden group-hover:border-blue transition-colors">
                  <div className="flex flex-col items-center justify-center w-full px-4">
                    <div className="w-16 rounded-full mb-1 bg-primary" style={{ height: `${norm.value}px`, minHeight: '1px', backgroundColor: 'var(--color-primary)' }}></div>
                    <span className="text-[10px] text-blue font-bold uppercase tracking-wider">{norm.brushName || 'Brush'}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Typography Norms */}
            {activeProject.typographyNorms && activeProject.typographyNorms.map((norm) => (
              <div key={norm.id} className="glass-card p-6 rounded-2xl relative group hover:bg-white/80 transition-all hover:-translate-y-1 duration-300">
                <div className="absolute top-3 right-3 flex gap-2 z-30">
                  <ActionIconButton
                    onClick={() => openEditNorm(norm, 'typography')}
                    title="Modifier la norme"
                    intent="edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                    </svg>
                  </ActionIconButton>
                  <ActionIconButton
                    onClick={(e) => handleDeleteNorm(e, norm.id, 'typography')}
                    title="Supprimer la norme"
                    intent="delete"
                  >
                    {loadingDelete === norm.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </ActionIconButton>
                </div>
                <div className="flex justify-between items-start mb-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white border border-pink shadow-sm text-pink">Typographie</span>
                </div>
                <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{norm.fontUsage || norm.fontFamily}</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-2xl font-light text-primary mr-1">{norm.fontFamily}</span>
                  <span className="text-lg text-blue font-medium">{norm.fontWeight}</span>
                </div>
                {norm.fontStyle && (
                  <div className="mb-2">
                    <span className="text-xs text-primary italic">{norm.fontStyle}</span>
                  </div>
                )}
                <div className="h-16 bg-blue/10 rounded-xl flex items-center justify-center border border-primary relative overflow-hidden group-hover:border-blue transition-colors">
                  <span className="text-primary text-xl font-medium tracking-tight" style={{fontFamily: norm.fontFamily, fontStyle: norm.fontStyle ? norm.fontStyle.toLowerCase() : undefined}}>AaBbCc</span>
                </div>
              </div>
            ))}
          </div>

          <AppModal
            isOpen={!!editingNorm}
            onClose={() => setEditingNorm(null)}
            showClose={false}
            panelClassName="max-w-sm"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>
            <h3 className="text-xl font-light text-primary mb-6 relative z-10">Modifier la Norme</h3>
            <div className="space-y-4 relative z-10">
              {editingType === 'brush' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Usage du Brush</label>
                    <input type="text" value={editBrushUsage} onChange={e => setEditBrushUsage(e.target.value)} placeholder="ex: Hair Lineart" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom du Brush</label>
                    <input type="text" value={editBrushName} onChange={e => setEditBrushName(e.target.value)} placeholder="ex: G-Pen" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Taille (px)</label>
                    <input type="text" value={editBrushValue} onChange={e => setEditBrushValue(e.target.value)} placeholder="ex: 8" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Unité</label>
                    <input type="text" value={editBrushUnit} onChange={e => setEditBrushUnit(e.target.value)} placeholder="px" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Famille de police</label>
                    <input type="text" value={editFontFamily} onChange={e => setEditFontFamily(e.target.value)} placeholder="ex: Inter" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Poids</label>
                    <input type="text" value={editFontWeight} onChange={e => setEditFontWeight(e.target.value)} placeholder="ex: 700" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Usage</label>
                    <input type="text" value={editFontUsage} onChange={e => setEditFontUsage(e.target.value)} placeholder="ex: Titre" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Style</label>
                    <input type="text" value={editFontStyle} onChange={e => setEditFontStyle(e.target.value)} placeholder="ex: Italic" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-8 relative z-10">
              <button onClick={() => setEditingNorm(null)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
                Annuler
              </button>
              <button onClick={handleEditNorm} disabled={editingType === 'brush' ? !editBrushUsage || !editBrushValue : !editFontFamily}
                      className="flex-1 py-3 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Modifier
              </button>
            </div>
          </AppModal>
        </>
      )}

      <AppModal
        isOpen={isAddingNorm}
        onClose={() => setIsAddingNorm(false)}
        showClose={false}
        panelClassName="max-w-sm"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <h3 className="text-xl font-light text-primary mb-6 relative z-10">Nouvelle Norme</h3>
        <div className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Type</label>
            <select value={addType} onChange={e => setAddType(e.target.value)} className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary appearance-none font-medium">
              <option value="brush">Trait</option>
              <option value="typography">Typographie</option>
            </select>
          </div>
          {addType === 'brush' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Usage du Brush</label>
                <input type="text" value={newBrushUsage} onChange={e => setNewBrushUsage(e.target.value)} placeholder="ex: Hair Lineart" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Nom du Brush</label>
                <input type="text" value={newBrushName} onChange={e => setNewBrushName(e.target.value)} placeholder="ex: G-Pen" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Taille (px)</label>
                <input type="text" value={newBrushValue} onChange={e => setNewBrushValue(e.target.value)} placeholder="ex: 8" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Unité</label>
                <input type="text" value={newBrushUnit} onChange={e => setNewBrushUnit(e.target.value)} placeholder="px" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Famille de police</label>
                <input type="text" value={newFontFamily} onChange={e => setNewFontFamily(e.target.value)} placeholder="ex: Inter" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Poids</label>
                <input type="text" value={newFontWeight} onChange={e => setNewFontWeight(e.target.value)} placeholder="ex: 700" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Usage</label>
                <input type="text" value={newFontUsage} onChange={e => setNewFontUsage(e.target.value)} placeholder="ex: Titre" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Style</label>
                <input type="text" value={newFontStyle} onChange={e => setNewFontStyle(e.target.value)} placeholder="ex: Italic" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 mt-8 relative z-10">
          <button onClick={() => setIsAddingNorm(false)} className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors">
            Annuler
          </button>
          <button onClick={handleAddNorm} disabled={addType === 'brush' ? !newBrushUsage || !newBrushValue : !newFontFamily}
                  className="flex-1 py-3 bg-blue text-primary font-medium rounded-xl hover:bg-pink/10 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            Ajouter
          </button>
        </div>
      </AppModal>
    </>
  );
}