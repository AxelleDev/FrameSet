// Project palette page (/app/project/:id/palette): add/edit/delete/copy/reorder
// color swatches (drag-and-drop with FLIP, plus keyboard move buttons).
// Every change persists the whole ordered palette via updateProjectPalette and
// adopts the server's canonical result. Colors are keyed by stable `id`, never
// hex, so two colors may share a hex without colliding.
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
import AddTile from '../components/AddTile';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Seo from '../components/Seo';
import ColorTile from '../components/ColorTile';
import { normalizeHexInput, isValidHexValue, handleHexKeyDown } from '../utils/hex';
import { EditIcon, DeleteIcon } from '../components/icons';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';
import useClipboard from '../hooks/useClipboard';
import useActiveProject from '../hooks/useActiveProject';
import { extractColorsFromImage } from '../utils/extractColors';

// Keep in sync with the backend cap (MAX_PALETTE_SIZE in projects.controller.js).
const MAX_PALETTE_SIZE = 50;

export default function ProjectPalette() {
  const { id } = useParams();
  const {
    activeProject,
    updateProjectPalette,
    projectsLoading,
    activeProjectId,
    trashedPaletteColors,
    fetchTrashedColors,
    deleteColor,
    restoreColor,
    deleteColorPermanently,
  } = useProjects();
  const { showToast } = useToast();

  const [editIdx, setEditIdx] = useState(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('');

  // Drag-and-drop state. draggedIndex/draggedId: the swatch being dragged.
  // dragOverIndex: the slot it would land in. palette: committed order;
  // previewPalette: live reorder shown during a drag (committed only on drop).
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [palette, setPalette] = useState([]);
  const [previewPalette, setPreviewPalette] = useState([]);
  // Refs for the FLIP animation. itemRefs: id -> DOM node (to measure).
  // prevPositions: id -> rect captured before a reorder (the "First").
  // skipFlip: suppress the animation next layout pass (e.g. on cancel).
  // didDrop: real drop vs. cancelled drag in onDragEnd.
  // flipPending: a reorder happened and the FLIP should run next.
  const itemRefs = useRef({});
  const prevPositions = useRef({});
  const skipFlip = useRef(false);
  const didDrop = useRef(false);
  const flipPending = useRef(false);
  // Holds the post-drop persistence timeout so it can be cancelled on unmount.
  const dropPersistTimer = useRef(null);

  // Cancel any pending post-drop persistence timer if we unmount before it fires.
  useEffect(() => () => clearTimeout(dropPersistTimer.current), []);

  const [confirmDeleteColor, setConfirmDeleteColor] = useState(null);
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  // Load this project's trashed colors so its trash section can appear (hidden when empty).
  useEffect(() => {
    if (id) fetchTrashedColors(id, { silent: true });
  }, [id, fetchTrashedColors]);

  // Trash actions: restore puts the color back in the grid; permanent delete is
  // staged behind its own confirmation dialog. Mutually exclusive (trashBusy) so
  // a restore in flight and a "delete forever" can never race on the same
  // soft-deleted row.
  const [confirmPermanentDeleteColor, setConfirmPermanentDeleteColor] = useState(null);
  const [restoringColorId, setRestoringColorId] = useState(null);
  const trashBusy = restoringColorId !== null || confirmPermanentDeleteColor !== null;
  const handleRestoreColor = async (colorId) => {
    if (trashBusy) return;
    setRestoringColorId(colorId);
    try {
      const ok = await restoreColor(id, colorId);
      if (ok) showToast('Color restored.');
    } finally {
      setRestoringColorId(null);
    }
  };

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

  // FLIP animation (First-Last-Invert-Play). After previewPalette re-renders
  // swatches into their new (Last) spots, this runs before paint: measure each
  // node, compute the delta from its pre-reorder (First) rect in prevPositions,
  // translate it back (Invert), then clear the transform with a transition so it
  // slides to the new spot (Play).
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

  // "Palette from an image" state. imageColors: extracted [{ hex, selected }]
  // shown in the modal. extracting: true while analyzing. fileInputRef: the
  // hidden <input type="file"> opened by the import button.
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageColors, setImageColors] = useState([]);
  const [imageError, setImageError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

  // Persist the ordered palette and adopt the server's canonical result (stable
  // ids, saved order). Returns the saved palette, or null on failure.
  const persistPalette = async (nextPalette) => {
    const saved = await updateProjectPalette(id, nextPalette);
    if (saved) {
      setPalette(saved);
      setPreviewPalette(saved);
    }
    return saved;
  };

  const handleEditHexChange = (e) => {
    setEditColorHex(normalizeHexInput(e.target.value));
  };

  const handleNewHexChange = (e) => {
    setNewColorHex(normalizeHexInput(e.target.value));
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
      showToast('Something went wrong saving your changes.', 'danger');
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

  // Move the swatch at `idx` to `target`, persist, and keep focus on it. Called
  // by the on-tile reorder buttons, so reordering works by a single click (and by
  // keyboard, since the buttons are focusable), not only by drag.
  const moveColor = async (idx, target) => {
    if (target < 0 || target >= palette.length) return;
    const previous = palette;
    const next = [...palette];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setPalette(next);
    setPreviewPalette(next);
    // Keep focus on the moved swatch after it re-renders into its new slot.
    requestAnimationFrame(() => {
      const el = itemRefs.current[moved.id];
      if (el) el.focus();
    });
    // Roll back the optimistic reorder if persistence failed, so local state
    // doesn't silently diverge from the server.
    const saved = await persistPalette(next);
    if (!saved) {
      setPalette(previous);
      setPreviewPalette(previous);
    }
  };

  return (
    <>
      <Seo title="Color palette" noindex />
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

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
           <AddTile
            onClick={openAddModal}
            label="New color"
            className="aspect-square"
           />

          {/* Live (preview) order; each node is registered in itemRefs (by id)
              for FLIP measurement, and the dragged swatch is dimmed. */}
          {previewPalette.map((color, idx) => (
            <ColorTile
              key={color.id}
              ref={el => { itemRefs.current[color.id] = el; }}
              tabIndex={-1}
              aria-label={`Color ${color.name}, ${color.hex}`}
              hex={color.hex}
              name={color.name}
              onCopy={(e) => handleCopyHex(e, color.hex)}
              copied={copiedValue === color.hex}
              className={color.id === draggedId ? 'opacity-30 z-40 cursor-grabbing' : 'cursor-grab'}
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
                  clearTimeout(dropPersistTimer.current);
                  dropPersistTimer.current = setTimeout(() => {
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
              overlay={
                <>
                  <ActionIconButton
                    onClick={(e) => handleDeleteColor(e, color.id)}
                    title="Delete color"
                    intent="delete"
                    variant="light"
                    className="absolute top-3 right-3 z-30"
                  >
                    <DeleteIcon />
                  </ActionIconButton>

                  <ActionIconButton
                    onClick={() => openEditModal(idx)}
                    title="Edit color"
                    intent="edit"
                    variant="light"
                    className="absolute top-3 left-3 z-30"
                  >
                    <EditIcon />
                  </ActionIconButton>

                  {/* Reorder controls: keyboard-operable, non-drag alternative
                      (WCAG 2.5.7). Visually hidden (srOnly) so sighted users
                      drag while assistive-tech users get "move left/right". */}
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
                </>
              }
            />
          ))}
          </div>

          {trashedPaletteColors.length > 0 && (
            <section className="mt-14" aria-labelledby="palette-trash-title">
              <h2 id="palette-trash-title" className="text-lg font-medium text-primary flex items-center">
                <DeleteIcon className="w-5 h-5 mr-2 text-blue shrink-0" />
                Trash
                <span className="ml-2 text-sm font-normal text-primary/50">({trashedPaletteColors.length})</span>
              </h2>
              <p className="text-xs text-primary/60 mt-1 mb-4">
                Deleted colors are kept for 30 days, then deleted forever.
              </p>
              <div className="space-y-3">
                {trashedPaletteColors.map((color) => (
                  <Card key={color.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full ring-2 ring-surface shrink-0"
                        style={{ backgroundColor: color.hex }}
                      ></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{color.name}</p>
                        <p className="text-xs text-primary/60">
                          {color.daysLeft <= 0
                            ? 'Will be deleted with the next cleanup'
                            : `${color.daysLeft} day${color.daysLeft === 1 ? '' : 's'} left before permanent deletion`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        className="text-sm"
                        onClick={() => handleRestoreColor(color.id)}
                        loading={restoringColorId === color.id}
                        disabled={trashBusy}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        className="text-sm"
                        disabled={trashBusy}
                        onClick={() => setConfirmPermanentDeleteColor({ id: color.id, name: color.name })}
                      >
                        Delete forever
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
        title="Move to trash?"
        message="You can restore it for 30 days; after that it is deleted forever."
        confirmLabel="Move to trash"
        onCancel={() => setConfirmDeleteColor(null)}
        onConfirm={async () => {
          if (confirmDeleteColor === null) return;
          const ok = await deleteColor(id, confirmDeleteColor);
          setConfirmDeleteColor(null);
          if (ok) showToast('Color moved to trash.');
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmPermanentDeleteColor}
        title="Delete forever?"
        message={
          confirmPermanentDeleteColor?.name
            ? `"${confirmPermanentDeleteColor.name}" will be permanently lost. This cannot be undone.`
            : 'This color will be permanently lost. This cannot be undone.'
        }
        confirmLabel="Delete forever"
        onCancel={() => setConfirmPermanentDeleteColor(null)}
        onConfirm={async () => {
          if (!confirmPermanentDeleteColor?.id) return;
          const ok = await deleteColorPermanently(id, confirmPermanentDeleteColor.id);
          setConfirmPermanentDeleteColor(null);
          if (ok) showToast('Color permanently deleted.');
        }}
      />
    </>
  );
}
