/**
 * Project palette page (route: /app/project/:id/palette).
 *
 * Displays the project's color swatches and lets the user add, edit, delete,
 * copy (hex to clipboard) and reorder colors. Reordering works both by
 * drag-and-drop (with a FLIP animation so the other swatches slide smoothly)
 * and by keyboard (arrow keys on a focused swatch).
 *
 * Every change persists the whole ordered palette through updateProjectPalette,
 * which returns the canonical palette from the server (each color carrying a
 * stable `id` and its saved order). Colors are identified by `id`, never by hex,
 * so two colors may share the same hex without colliding.
 */
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
import useActiveProject from '../hooks/useActiveProject';

export default function ProjectPalette() {
  const { id } = useParams();
  const { activeProject, updateProjectPalette } = useProjects();

  const [editStatus, setEditStatus] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('');

  // Drag-and-drop state:
  //   draggedIndex/draggedId: the swatch being dragged (by index and id).
  //   dragOverIndex: the slot the dragged swatch would land in.
  //   palette: the committed order; previewPalette: the live reordered order
  //     shown during a drag (committed to `palette` only on drop).
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [palette, setPalette] = useState([]);
  const [previewPalette, setPreviewPalette] = useState([]);
  // Refs used by the FLIP animation:
  //   itemRefs: color id -> DOM node, to measure positions.
  //   prevPositions: color id -> bounding rect captured *before* a reorder (First).
  //   skipFlip: suppress the animation for the next layout pass (e.g. on cancel).
  //   didDrop: distinguishes a real drop from a cancelled drag in onDragEnd.
  //   flipPending: marks that a reorder happened and the FLIP should run next.
  const itemRefs = useRef({});
  const prevPositions = useRef({});
  const skipFlip = useRef(false);
  const didDrop = useRef(false);
  const flipPending = useRef(false);

  const [confirmDeleteColor, setConfirmDeleteColor] = useState(null);
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  // Copy a swatch's hex to the clipboard (stop the click from starting a drag).
  const handleCopyHex = async (e, hex) => {
    e.preventDefault();
    e.stopPropagation();
    await copy(hex);
  };

  // Mirror the project's palette into local state whenever it loads/changes.
  useEffect(() => {
    if (activeProject && Array.isArray(activeProject.palette)) {
      setPalette(activeProject.palette);
      setPreviewPalette(activeProject.palette);
    }
  }, [activeProject]);

  // FLIP animation (First-Last-Invert-Play). After the previewPalette reorder
  // re-renders the swatches into their new ("Last") positions, this runs
  // synchronously before paint to: measure each node's current position,
  // compute the delta from its pre-reorder ("First") position captured in
  // prevPositions, instantly translate it back to where it was (Invert), then
  // clear the transform with a transition so it animates to its new spot (Play).
  useLayoutEffect(() => {
    // Cancelled drag: clear any inline styles and skip animating this pass.
    if (skipFlip.current) {
      skipFlip.current = false;
      Object.values(itemRefs.current).forEach(el => {
        if (el) { el.style.transition = ''; el.style.transform = ''; }
      });
      return;
    }
    // Only animate while dragging and only when a reorder just occurred.
    if (draggedId === null) return;
    if (!flipPending.current) return;
    flipPending.current = false;
    previewPalette.forEach(color => {
      // The dragged swatch is shown semi-transparent and is not FLIP-animated.
      if (color.id === draggedId) return;
      const el = itemRefs.current[color.id];
      const prev = prevPositions.current[color.id];
      if (!el || !prev) return;
      const curr = el.getBoundingClientRect();
      const dx = Math.round(prev.left - curr.left);
      const dy = Math.round(prev.top - curr.top);
      if (dx !== 0 || dy !== 0) {
        // Invert: jump back to the old position with no transition.
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        // Force a reflow so the inverted transform is applied before we animate.
        el.getBoundingClientRect();
        // Play: transition the transform away, sliding into the new position.
        el.style.transition = 'transform 280ms cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = '';
      }
    });
  }, [previewPalette, draggedId]);

  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  /**
   * Persists the given ordered palette and adopts the canonical result returned
   * by the server (with stable ids and saved order).
   * @param {Array} nextPalette The desired palette, in order.
   * @returns {Promise<Array|null>} The saved palette, or null on failure.
   */
  const persistPalette = async (nextPalette) => {
    const saved = await updateProjectPalette(id, nextPalette);
    if (saved) {
      setPalette(saved);
      setPreviewPalette(saved);
    }
    return saved;
  };

  /**
   * Normalizes a hex color input: always keeps a leading '#', strips any
   * non-hex characters, and uppercases. Used to keep hex fields well-formed.
   * @param {string} val Raw input value.
   * @returns {string} Normalized hex string (e.g. "#FF00AA").
   */
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

  // Prevent deleting the mandatory leading '#' via Backspace/Delete.
  const handleHexKeyDown = (e) => {
    const el = e.target;
    const selStart = el.selectionStart || 0;
    const selEnd = el.selectionEnd || 0;
    if ((e.key === 'Backspace' && selStart <= 1 && selEnd <= 1) || (e.key === 'Delete' && selStart === 0)) {
      e.preventDefault();
    }
  };

  // Normalize pasted content before it lands in the field.
  // Returns a paste handler bound to the given state setter.
  const handleHexPaste = (setter) => (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
    const cleaned = normalizeHexInput(paste);
    setter(cleaned);
  };

  useActiveProject(id);

  const renderEditStatus = () => {
    if (editStatus === 'error') {
      return <div className="text-xs text-pink mt-2">Erreur lors de la modification.</div>;
    }
    if (editStatus === 'success') {
      return <div className="text-xs text-green-700 mt-2">Modification enregistrée.</div>;
    }
    return null;
  };

  // Open the edit modal pre-filled from the color at the given index.
  const openEditModal = (idx) => {
    setEditIdx(idx);
    setEditColorName(palette[idx]?.name || '');
    setEditColorHex(palette[idx]?.hex || '#');
    setEditStatus(null);
  };

  // Whether the given hex string is a valid 3- or 6-digit hex color.
  const isValidHexValue = (value) => {
    const hex = (value || '').trim();
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex.startsWith('#') ? hex : '#' + hex);
  };

  const isValidEditHex = () => isValidHexValue(editColorHex);
  const isValidHex = () => isValidHexValue(newColorHex);

  const openAddModal = () => {
    setNewColorName('');
    setNewColorHex('#');
    setIsAddingColor(true);
  };

  // Persist a color edit (the edited color keeps its id) and show status.
  const confirmEditColor = async () => {
    if (editIdx === null || !editColorName || !isValidEditHex()) return;
    const currentColor = palette[editIdx];
    if (!currentColor) return;

    const normalizedName = editColorName.trim();
    if (!normalizedName) return;

    let newHex = editColorHex.trim();
    if (!newHex.startsWith('#')) newHex = '#' + newHex;

    const nextPalette = palette.map((color, idx) => (
      idx === editIdx ? { ...color, name: normalizedName, hex: newHex } : color
    ));

    const saved = await persistPalette(nextPalette);
    setEditStatus(saved ? 'success' : 'error');
  };

  // Append a new color (no id yet; the server assigns one) and sync local state.
  const confirmAddColor = async () => {
    if (!id || !newColorName || !isValidHex()) return;
    const normalizedName = newColorName.trim();
    if (!normalizedName) return;

    let hex = newColorHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;

    const nextPalette = [...palette, { name: normalizedName, hex }];
    const saved = await persistPalette(nextPalette);
    if (saved) {
      setIsAddingColor(false);
    }
  };

  // Stage a color for deletion (by id). stopImmediatePropagation also prevents
  // sibling handlers (copy/drag) on the same swatch from firing.
  const handleDeleteColor = (e, colorId) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setConfirmDeleteColor(colorId);
  };

  // Keyboard reordering: move the focused swatch with the arrow keys. Ignored
  // when focus is on a nested button (delete/edit) rather than the swatch itself.
  const handleSwatchKeyDown = (e, idx) => {
    if (e.target !== e.currentTarget) return;
    let target = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = idx - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = idx + 1;
    else return;
    if (target < 0 || target >= palette.length) return;

    e.preventDefault();
    const next = [...palette];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setPalette(next);
    setPreviewPalette(next);
    persistPalette(next);
    // Keep focus on the moved swatch after it re-renders into its new slot.
    requestAnimationFrame(() => {
      const el = itemRefs.current[moved.id];
      if (el) el.focus();
    });
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

          {/* Render the live (preview) order; each node is registered in itemRefs
              (by id) for FLIP measurement, and the dragged swatch is dimmed. */}
          {previewPalette.map((color, idx) => (
            <div
              key={color.id}
              ref={el => { itemRefs.current[color.id] = el; }}
              tabIndex={0}
              role="button"
              aria-label={`Couleur ${color.name}, ${color.hex}. Utilisez les flèches pour réordonner.`}
              className={`group relative flex flex-col aspect-[4/5] rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-pink/70 focus-visible:ring-offset-2 ${color.id === draggedId ? 'opacity-30 z-40 cursor-grabbing' : 'cursor-grab'}`}
              draggable
              onKeyDown={e => handleSwatchKeyDown(e, idx)}
              onDragStart={e => {
                // Begin a drag: reset FLIP bookkeeping and record the source swatch.
                didDrop.current = false;
                flipPending.current = false;
                prevPositions.current = {};
                setDraggedIndex(idx);
                setDraggedId(color.id);
                setDragOverIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={e => {
                e.preventDefault();
                // When hovering a new target slot, snapshot current positions
                // (the FLIP "First") and compute the previewed reorder so the
                // layout effect can animate the displaced swatches.
                if (draggedId !== null && color.id !== draggedId) {
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
                // Commit the reorder: mark didDrop so onDragEnd does not revert,
                // update the committed palette, and persist after a short delay
                // so the drop animation can settle first.
                didDrop.current = true;
                flipPending.current = false;
                if (draggedId !== null && draggedIndex !== dragOverIndex) {
                  const newPalette = [...palette];
                  const [moved] = newPalette.splice(draggedIndex, 1);
                  newPalette.splice(dragOverIndex, 0, moved);
                  setPalette(newPalette);
                  setTimeout(() => {
                    persistPalette(newPalette);
                  }, 200);
                }
                setDraggedIndex(null);
                setDraggedId(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                // Fires after every drag. If a drop already committed, just reset.
                if (didDrop.current) {
                  didDrop.current = false;
                  flipPending.current = false;
                  setDraggedIndex(null);
                  setDraggedId(null);
                  setDragOverIndex(null);
                  return;
                }
                // Otherwise the drag was cancelled (dropped outside): revert the
                // preview to the committed order and skip the FLIP animation.
                skipFlip.current = true;
                flipPending.current = false;
                setDraggedIndex(null);
                setDraggedId(null);
                setDragOverIndex(null);
                setPreviewPalette(palette);
              }}
            >
              <div className="flex-1 w-full rounded-[2rem] shadow-lg relative overflow-hidden transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-xl"
                   style={{ backgroundColor: color.hex }}>
                   <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50 pointer-events-none"></div>

                   <ActionIconButton
                      onClick={(e) => handleDeleteColor(e, color.id)}
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
          primaryDisabled={!editColorName || !isValidEditHex()}
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
          primaryDisabled={!newColorName || !isValidHex()}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={confirmDeleteColor !== null}
        title="Supprimer la couleur"
        message="Êtes-vous sûr de vouloir supprimer cette couleur ?"
        confirmLabel="Supprimer"
        confirmClassName="bg-pink text-white hover:bg-pink/10"
        onCancel={() => setConfirmDeleteColor(null)}
        onConfirm={async () => {
          if (confirmDeleteColor === null) return;
          // Delete by removing the color (matched by id) and persisting the rest.
          const nextPalette = palette.filter((color) => color.id !== confirmDeleteColor);
          const saved = await persistPalette(nextPalette);
          if (saved) {
            setConfirmDeleteColor(null);
          }
        }}
      />
    </>
  );
}
