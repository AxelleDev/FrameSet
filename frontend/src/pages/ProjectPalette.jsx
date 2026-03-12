import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyBadge from '../components/CopyBadge';
import AddTile from '../components/AddTile';
import PageHeader from '../components/PageHeader';
import useClipboard from '../hooks/useClipboard';
import api from '../services/api';

export default function ProjectPalette() {
  const { id } = useParams();
  const { user, setGlobalError } = useAuth();
  const { setActiveProjectId, activeProject, updateProjectPalette, deleteProjectPaletteColor } = useProjects();

  const [editStatus, setEditStatus] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('');

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedHex, setDraggedHex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [palette, setPalette] = useState([]);
  const [previewPalette, setPreviewPalette] = useState([]);
  const itemRefs = useRef({});
  const prevPositions = useRef({});
  const skipFlip = useRef(false);
  const didDrop = useRef(false);
  const flipPending = useRef(false);

  const [confirmDeleteColor, setConfirmDeleteColor] = useState(null);
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  const handleCopyHex = async (e, hex) => {
    e.preventDefault();
    e.stopPropagation();
    await copy(hex);
  };

  useEffect(() => {
    if (activeProject && Array.isArray(activeProject.palette)) {
      setPalette(activeProject.palette);
      setPreviewPalette(activeProject.palette);
    }
  }, [activeProject]);
  
    useLayoutEffect(() => {
      if (skipFlip.current) {
        skipFlip.current = false;
        Object.values(itemRefs.current).forEach(el => {
          if (el) { el.style.transition = ''; el.style.transform = ''; }
        });
        return;
      }
      if (draggedHex === null) return;
      if (!flipPending.current) return;
      flipPending.current = false;
      previewPalette.forEach(color => {
        if (color.hex === draggedHex) return;
        const el = itemRefs.current[color.hex];
        const prev = prevPositions.current[color.hex];
        if (!el || !prev) return;
        const curr = el.getBoundingClientRect();
        const dx = Math.round(prev.left - curr.left);
        const dy = Math.round(prev.top - curr.top);
        if (dx !== 0 || dy !== 0) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.getBoundingClientRect();
          el.style.transition = 'transform 280ms cubic-bezier(0.2, 0, 0, 1)';
          el.style.transform = '';
        }
      });
    }, [previewPalette, draggedHex]);

  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  const normalizeHexInput = (val) => {
    if (val == null) return '#';
    let v = String(val).trim();
    if (!v.startsWith('#')) v = '#' + v;
    v = '#' + v.slice(1).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    return v;
  };

  const handleEditHexChange = (e) => {
    setEditColorHex(normalizeHexInput(e.target.value));
  };

  const handleNewHexChange = (e) => {
    setNewColorHex(normalizeHexInput(e.target.value));
  };

  const handleHexKeyDown = (e) => {
    const el = e.target;
    const selStart = el.selectionStart || 0;
    const selEnd = el.selectionEnd || 0;
    if ((e.key === 'Backspace' && selStart <= 1 && selEnd <= 1) || (e.key === 'Delete' && selStart === 0)) {
      e.preventDefault();
    }
  };

  const handleHexPaste = (setter) => (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
    const cleaned = normalizeHexInput(paste);
    setter(cleaned);
  };

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
      await api.patch(`/projects/${id}/palette`, { oldHex, newName: editColorName, newHex }, { onGlobalError: setGlobalError });
      setEditStatus('success');
      await syncPalette();
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
    setConfirmDeleteColor(colorHex);
  };

  const syncPalette = async () => {
    if (user && user.id) {
      window.location.reload();
    }
  };

  return (
    <>
      <PageHeader
        title="Palette de Couleurs"
        subtitle="Ensemble des couleurs de référence à utiliser pour ce projet."
      />

      {activeProject && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
           <AddTile
            onClick={openAddModal}
            className="aspect-[4/5]"
           />

          {previewPalette.map((color, idx) => (
            <div
              key={color.hex}
              ref={el => { itemRefs.current[color.hex] = el; }}
              className={`group relative flex flex-col aspect-[4/5] ${color.hex === draggedHex ? 'opacity-30 z-40 cursor-grabbing' : 'cursor-grab'}`}
              draggable
              onDragStart={e => {
                didDrop.current = false;
                flipPending.current = false;
                prevPositions.current = {};
                setDraggedIndex(idx);
                setDraggedHex(color.hex);
                setDragOverIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={e => {
                e.preventDefault();
                if (draggedHex !== null && color.hex !== draggedHex) {
                  if (idx === dragOverIndex) return;
                  const snapshots = {};
                  Object.keys(itemRefs.current).forEach(key => {
                    const el = itemRefs.current[key];
                    if (el) snapshots[key] = el.getBoundingClientRect();
                  });
                  prevPositions.current = snapshots;
                  flipPending.current = true;
                  setDragOverIndex(idx);
                  const tempPalette = [...palette];
                  const [moved] = tempPalette.splice(draggedIndex, 1);
                  tempPalette.splice(idx, 0, moved);
                  setPreviewPalette(tempPalette);
                }
              }}
              onDrop={e => {
                e.preventDefault();
                didDrop.current = true;
                flipPending.current = false;
                if (draggedHex !== null && draggedIndex !== dragOverIndex) {
                  const newPalette = [...palette];
                  const [moved] = newPalette.splice(draggedIndex, 1);
                  newPalette.splice(dragOverIndex, 0, moved);
                  setPalette(newPalette);
                  setTimeout(() => {
                    updateProjectPalette(id, newPalette);
                  }, 200);
                }
                setDraggedIndex(null);
                setDraggedHex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                if (didDrop.current) {
                  didDrop.current = false;
                  flipPending.current = false;
                  setDraggedIndex(null);
                  setDraggedHex(null);
                  setDragOverIndex(null);
                  return;
                }
                skipFlip.current = true;
                flipPending.current = false;
                setDraggedIndex(null);
                setDraggedHex(null);
                setDragOverIndex(null);
                setPreviewPalette(palette);
              }}
            >
              <div className="flex-1 w-full rounded-[2rem] shadow-lg relative overflow-hidden transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-xl"
                   style={{ backgroundColor: color.hex }}>
                   <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50 pointer-events-none"></div>

                   <ActionIconButton
                      onClick={(e) => handleDeleteColor(e, color.hex)}
                      title="Supprimer la couleur"
                      intent="delete"
                      variant="light"
                      className="absolute top-3 right-3 z-30"
                   >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                   </ActionIconButton>

                    <ActionIconButton
                      onClick={() => openEditModal(idx)}
                      title="Modifier la couleur"
                      intent="edit"
                      variant="light"
                      className="absolute top-3 left-3 z-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                      </svg>
                    </ActionIconButton>

                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[2px] cursor-pointer z-10"
                        onClick={e => handleCopyHex(e, color.hex)}>
                      <CopyBadge isCopied={copiedValue === color.hex} />
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

      <FormModal
        isOpen={editIdx !== null}
        onClose={() => setEditIdx(null)}
        title="Modifier la couleur"
      >
        <div className="space-y-4">
          <FormField label="Nom de la couleur">
            <input type="text" value={editColorName} onChange={e => setEditColorName(e.target.value)} placeholder="ex: Reflet Cheveux" 
              className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
          </FormField>
          <FormField label="Code Hexadécimal">
            <div className="flex gap-3">
               <div className="w-12 h-12 rounded-xl border border-blue shadow-inner flex-shrink-0" style={{ backgroundColor: isValidEditHex() ? editColorHex : '#ffffff' }}></div>
               <input
                 type="text"
                 value={editColorHex}
                 onChange={handleEditHexChange}
                 onKeyDown={handleHexKeyDown}
                 onPaste={handleHexPaste(setEditColorHex)}
                 placeholder="ex: #FF5500"
                 className="flex-1 px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary font-mono uppercase"
               />
            </div>
          </FormField>
          {renderEditStatus()}
        </div>
        <ModalActions
          secondaryLabel="Annuler"
          primaryLabel="Confirmer"
          onSecondary={() => setEditIdx(null)}
          onPrimary={confirmEditColor}
          primaryDisabled={!editColorName || !editColorHex}
        />
      </FormModal>

      <FormModal
        isOpen={isAddingColor}
        onClose={() => setIsAddingColor(false)}
        title="Nouvelle Couleur"
      >
        <div className="space-y-4">
          <FormField label="Nom de la couleur">
            <input type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="ex: Reflet Cheveux" 
              className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
          </FormField>
          
          <FormField label="Code Hexadécimal">
            <div className="flex gap-3">
               <div className="w-12 h-12 rounded-xl border border-blue shadow-inner flex-shrink-0" style={{ backgroundColor: isValidHex() ? newColorHex : '#ffffff' }}></div>
               <input
                 type="text"
                 value={newColorHex}
                 onChange={handleNewHexChange}
                 onKeyDown={handleHexKeyDown}
                 onPaste={handleHexPaste(setNewColorHex)}
                 placeholder="ex: #FF5500"
                 className="flex-1 px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary font-mono uppercase"
               />
            </div>
          </FormField>
        </div>

        <ModalActions
          secondaryLabel="Annuler"
          primaryLabel="Ajouter"
          onSecondary={() => setIsAddingColor(false)}
          onPrimary={confirmAddColor}
          primaryDisabled={!newColorName || !newColorHex}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteColor}
        title="Supprimer la couleur"
        message="Êtes-vous sûr de vouloir supprimer cette couleur ?"
        confirmLabel="Supprimer"
        confirmClassName="bg-pink text-white hover:bg-pink/10"
        onCancel={() => setConfirmDeleteColor(null)}
        onConfirm={async () => {
          if (confirmDeleteColor) {
            await deleteProjectPaletteColor(id, confirmDeleteColor);
            await syncPalette();
          }
          setConfirmDeleteColor(null);
        }}
      />
    </>
  );
}