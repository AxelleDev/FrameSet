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
import { useToast } from '../context/ToastContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyBadge from '../components/CopyBadge';
import AddTile from '../components/AddTile';
import PageHeader from '../components/PageHeader';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';
import useClipboard from '../hooks/useClipboard';
import useActiveProject from '../hooks/useActiveProject';
import { extractColorsFromImage } from '../utils/extractColors';

// Keep in sync with the backend cap (MAX_PALETTE_SIZE in projects.controller.js).
const MAX_PALETTE_SIZE = 50;

export default function ProjectPalette() {
  const { id } = useParams();
  const { activeProject, updateProjectPalette, projectsLoading, activeProjectId } = useProjects();
  const { showToast } = useToast();

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

  // "Palette from an image" state:
  //   imageColors: extracted colors as [{ hex, selected }] shown in the modal.
  //   extracting: true while analyzing the chosen image.
  //   fileInputRef: the hidden <input type="file"> opened by the import button.
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageColors, setImageColors] = useState([]);
  const [imageError, setImageError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

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

  // Open the edit modal pre-filled from the color at the given index.
  const openEditModal = (idx) => {
    setEditIdx(idx);
    setEditColorName(palette[idx]?.name || '');
    setEditColorHex(palette[idx]?.hex || '#');
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
    if (saved) {
      setEditIdx(null);
      showToast('Color updated.');
    } else {
      showToast('Something went wrong saving your changes.', 'error');
    }
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
      showToast('Color added.');
    }
  };

  // Open the OS file picker to import a palette from an image.
  const openImagePicker = () => {
    setImageError('');
    fileInputRef.current?.click();
  };

  // Extract dominant colors from the chosen image, then open the preview modal.
  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected later
    if (!file) return;

    setExtracting(true);
    setImageError('');
    try {
      const hexes = await extractColorsFromImage(file, 8);
      if (hexes.length === 0) {
        setImageError('No colors could be extracted from this image.');
        return;
      }
      setImageColors(hexes.map((hex) => ({ hex, selected: true })));
      setIsImageModalOpen(true);
    } catch {
      setImageError('This image could not be analyzed.');
    } finally {
      setExtracting(false);
    }
  };

  // Toggle whether an extracted color will be added to the palette.
  const toggleImageColor = (hex) => {
    setImageColors((prev) => prev.map((c) => (c.hex === hex ? { ...c, selected: !c.selected } : c)));
  };

  // Append the selected extracted colors (capped at MAX_PALETTE_SIZE) and persist.
  const confirmAddImageColors = async () => {
    const chosen = imageColors.filter((c) => c.selected);
    if (chosen.length === 0) return;

    const room = Math.max(0, MAX_PALETTE_SIZE - palette.length);
    if (room === 0) {
      setImageError(`The palette is full (maximum ${MAX_PALETTE_SIZE} colors).`);
      return;
    }

    const toAdd = chosen.slice(0, room).map((c, i) => ({
      name: `Color ${palette.length + i + 1}`,
      hex: c.hex,
    }));

    const saved = await persistPalette([...palette, ...toAdd]);
    if (saved) {
      setIsImageModalOpen(false);
      setImageColors([]);
      showToast(`${toAdd.length} color${toAdd.length > 1 ? 's' : ''} added.`);
    }
  };

  // Stage a color for deletion (by id). stopImmediatePropagation also prevents
  // sibling handlers (copy/drag) on the same swatch from firing.
  const handleDeleteColor = (e, colorId) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setConfirmDeleteColor(colorId);
  };

  // Move the swatch at `idx` to position `target`, persist, and keep focus on it.
  // Shared by the arrow-key handler and the on-tile reorder buttons (so the
  // reorder works by keyboard AND by a single pointer click, not only by drag).
  const moveColor = (idx, target) => {
    if (target < 0 || target >= palette.length) return;
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
        title="Color palette"
        subtitle="This project's reference colors."
        actions={activeProject ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelected}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={openImagePicker}
              disabled={extracting}
            >
              {extracting ? 'Analyzing…' : 'Palette from an image'}
            </Button>
          </>
        ) : null}
      />

      {activeProject ? (
        <>
          {imageError && !isImageModalOpen && (
            <p className="text-xs text-danger mb-4 text-right">{imageError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
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
              tabIndex={-1}
              aria-label={`Color ${color.name}, ${color.hex}`}
              className={`group relative flex flex-col aspect-[4/5] rounded-3xl outline-none ${color.id === draggedId ? 'opacity-30 z-40 cursor-grabbing' : 'cursor-grab'}`}
              draggable
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
              {/* No `overflow-hidden` here on purpose: combined with `rounded-3xl`
                  and the hover transform below, Chrome drops the rounded clip
                  mid-animation and the inset overlay flashes square corners.
                  The swatch keeps its own rounded background, and the only
                  full-bleed child (the copy overlay) is rounded to match. */}
              <div className="flex-1 w-full rounded-3xl relative transition-transform duration-slow group-hover:-translate-y-2"
                   style={{ backgroundColor: color.hex }}>

                   <ActionIconButton
                      onClick={(e) => handleDeleteColor(e, color.id)}
                      title="Delete color"
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
                      title="Edit color"
                      intent="edit"
                      variant="light"
                      className="absolute top-3 left-3 z-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                      </svg>
                    </ActionIconButton>

                   {/* Reorder controls: a keyboard-operable, non-drag alternative
                       (WCAG 2.5.7). Rendered visually hidden (srOnly) so sighted
                       users reorder by drag-and-drop while assistive-tech users
                       still get explicit "move left/right" actions. */}
                   <div className="absolute bottom-3 inset-x-3 flex justify-between z-30">
                     <ActionIconButton
                       onClick={(e) => { e.stopPropagation(); moveColor(idx, idx - 1); }}
                       title="Move color left"
                       variant="light"
                       srOnly
                       disabled={idx === 0}
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                       </svg>
                     </ActionIconButton>
                     <ActionIconButton
                       onClick={(e) => { e.stopPropagation(); moveColor(idx, idx + 1); }}
                       title="Move color right"
                       variant="light"
                       srOnly
                       disabled={idx === previewPalette.length - 1}
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                       </svg>
                     </ActionIconButton>
                   </div>

                   {/* Copy-to-clipboard: a real button so it is keyboard-operable
                       (WCAG 2.1.1), revealed on hover or keyboard focus. */}
                   <button
                     type="button"
                     onClick={e => handleCopyHex(e, color.hex)}
                     aria-label={`Copy ${color.hex}`}
                     className="absolute inset-0 flex items-center justify-center rounded-3xl opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity bg-black/15 cursor-pointer z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                   >
                      <CopyBadge isCopied={copiedValue === color.hex} />
                   </button>
              </div>
              <div className="mt-4 text-center">
                 <p className="text-sm font-semibold text-primary truncate" title={color.name}>{color.name}</p>
                 <p className="text-xs text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity">{color.hex}</p>
              </div>
            </div>
          ))}
          </div>
        </>
      ) : (
        <ProjectStatePlaceholder loading={projectsLoading || String(activeProjectId) !== String(id)} />
      )}

      <FormModal
        isOpen={editIdx !== null}
        onClose={() => setEditIdx(null)}
        title="Edit color"
      >
        <div className="space-y-4">
          <FormField label="Color name">
            <TextInput type="text" value={editColorName} onChange={e => setEditColorName(e.target.value)} placeholder="Hair highlight" />
          </FormField>
          <FormField label="Hex code">
            <div className="flex gap-3">
               <input
                 type="color"
                 value={isValidEditHex() ? editColorHex : '#ffffff'}
                 onChange={(e) => setEditColorHex(e.target.value.toUpperCase())}
                 aria-label="Pick a color"
                 className="w-12 h-12 flex-shrink-0 cursor-pointer rounded-xl border border-blue/30 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0"
               />
               <TextInput
                 type="text"
                 value={editColorHex}
                 onChange={handleEditHexChange}
                 onKeyDown={handleHexKeyDown}
                 onPaste={handleHexPaste(setEditColorHex)}
                 placeholder="#FF5500"
                 mono
                 className="flex-1"
               />
            </div>
          </FormField>
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Save"
          onSecondary={() => setEditIdx(null)}
          onPrimary={confirmEditColor}
          primaryDisabled={!editColorName || !isValidEditHex()}
        />
      </FormModal>

      <FormModal
        isOpen={isAddingColor}
        onClose={() => setIsAddingColor(false)}
        title="New color"
      >
        <div className="space-y-4">
          <FormField label="Color name">
            <TextInput type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="Hair highlight" />
          </FormField>

          <FormField label="Hex code">
            <div className="flex gap-3">
               <input
                 type="color"
                 value={isValidHex() ? newColorHex : '#ffffff'}
                 onChange={(e) => setNewColorHex(e.target.value.toUpperCase())}
                 aria-label="Pick a color"
                 className="w-12 h-12 flex-shrink-0 cursor-pointer rounded-xl border border-blue/30 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0"
               />
               <TextInput
                 type="text"
                 value={newColorHex}
                 onChange={handleNewHexChange}
                 onKeyDown={handleHexKeyDown}
                 onPaste={handleHexPaste(setNewColorHex)}
                 placeholder="#FF5500"
                 mono
                 className="flex-1"
               />
            </div>
          </FormField>
        </div>

        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Add"
          onSecondary={() => setIsAddingColor(false)}
          onPrimary={confirmAddColor}
          primaryDisabled={!newColorName || !isValidHex()}
        />
      </FormModal>

      <FormModal
        isOpen={isImageModalOpen}
        onClose={() => { setIsImageModalOpen(false); setImageColors([]); }}
        title="Palette from an image"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary">
            Colors extracted from the image — click to select or deselect the ones to add.
          </p>
          <div className="grid grid-cols-4 gap-3">
            {imageColors.map(({ hex, selected }) => (
              <button
                type="button"
                key={hex}
                onClick={() => toggleImageColor(hex)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${selected ? 'ring-2 ring-blue/40' : 'opacity-50 hover:opacity-100'}`}
              >
                <span className="w-full h-12 rounded-lg " style={{ backgroundColor: hex }}></span>
                <span className="text-xs font-mono text-primary uppercase">{hex}</span>
              </button>
            ))}
          </div>
          {imageError && <p className="text-xs text-danger">{imageError}</p>}
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel={`Add (${imageColors.filter((c) => c.selected).length})`}
          onSecondary={() => { setIsImageModalOpen(false); setImageColors([]); }}
          onPrimary={confirmAddImageColors}
          primaryDisabled={imageColors.filter((c) => c.selected).length === 0}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={confirmDeleteColor !== null}
        title="Delete color?"
        message="It will be removed from the palette."
        confirmLabel="Delete"
       
        onCancel={() => setConfirmDeleteColor(null)}
        onConfirm={async () => {
          if (confirmDeleteColor === null) return;
          // Delete by removing the color (matched by id) and persisting the rest.
          const nextPalette = palette.filter((color) => color.id !== confirmDeleteColor);
          const saved = await persistPalette(nextPalette);
          if (saved) {
            setConfirmDeleteColor(null);
            showToast('Color deleted.');
          }
        }}
      />
    </>
  );
}
