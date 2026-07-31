// Project palette page (/app/project/:id/palette): add/edit/delete/copy/reorder
// color swatches (drag-and-drop with FLIP, plus keyboard move buttons).
// Every change persists the whole ordered palette via updateProjectPalette and
// adopts the server's canonical result. Colors are keyed by stable `id`, never
// hex, so two colors may share a hex without colliding.
import React, { useState, useEffect, useRef } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import Alert from '../components/Alert';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import PageHeader from '../components/PageHeader';
import Seo from '../components/Seo';
import ColorTile from '../components/ColorTile';
import ColorFormatToggle from '../components/ColorFormatToggle';
import ColorInput from '../components/ColorInput';
import TrashSection from '../components/TrashSection';
import TrashRow from '../components/TrashRow';
import { isValidHexValue } from '../utils/hex';
import { findDuplicateColor } from '../utils/duplicates';
import { formatColor, isColorFormat } from '../utils/colorFormats';
import { generateHarmonies } from '../utils/colorHarmony';
import { EditIcon, DeleteIcon, DuplicateIcon } from '../components/icons';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';
import useClipboard from '../hooks/useClipboard';
import useActiveProject from '../hooks/useActiveProject';
import useDragReorder from '../hooks/useDragReorder';
import useLongPressReveal from '../hooks/useLongPressReveal';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';
import { extractColorsFromImage } from '../utils/extractColors';
import { parsePaletteFile } from '../utils/paletteImport';
import { MAX_PALETTE_SIZE } from '../constants/backendContract';

// Remembers the palette's display-format preference across visits/reloads.
const PALETTE_FORMAT_KEY = 'frameset-palette-format';

export default function ProjectPalette() {
  const { id } = useParams();
  const {
    activeProject,
    activeProjectNotFound,
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
  // Canonical hex ('#RRGGBB' when valid, '' otherwise) reported by ColorInput.
  const [editColorHex, setEditColorHex] = useState('');

  // Drag-and-drop reorder (FLIP animation + keyboard move + optimistic
  // persistence), shared with ProjectNorms and the dashboard's pinned section.
  const {
    items: palette,
    previewItems: previewPalette,
    draggedId,
    registerItemRef,
    getDragHandlers,
    moveItem: moveColor,
    replaceItems: persistPalette,
  } = useDragReorder({
    items: activeProject?.palette,
    getId: (color) => color.id,
    onPersist: (nextPalette) => updateProjectPalette(id, nextPalette),
  });

  // Touch counterpart of the tiles' hover-revealed actions: long-press a tile
  // to show them (see useLongPressReveal), instead of a tap-graze flashing them.
  const { getRevealProps } = useLongPressReveal();

  const [confirmDeleteColor, setConfirmDeleteColor] = useState(null);
  const { copy, copiedValue } = useClipboard({ timeout: 1200 });

  // How palette colors are displayed (HEX / RGB / HSL / HSB). A pure display
  // preference — never changes the stored colors — restored from and saved to
  // localStorage so it sticks across visits.
  const [displayFormat, setDisplayFormat] = useState(() => {
    try {
      const saved = localStorage.getItem(PALETTE_FORMAT_KEY);
      return saved && isColorFormat(saved) ? saved : 'hex';
    } catch {
      return 'hex';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PALETTE_FORMAT_KEY, displayFormat);
    } catch {
      /* ignore persistence errors (e.g. private mode) */
    }
  }, [displayFormat]);

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

  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  const editingOriginalColor = editIdx !== null ? palette[editIdx] : null;
  useUnsavedChangesWarning(
    (isAddingColor && (newColorName.trim() !== '' || newColorHex !== '')) ||
      (editIdx !== null &&
        editingOriginalColor &&
        (editColorName !== editingOriginalColor.name ||
          // ColorInput normalizes to uppercase hex; compare case-insensitively
          // so merely opening the modal on a stored lowercase hex isn't "dirty".
          editColorHex.toUpperCase() !== (editingOriginalColor.hex || '').toUpperCase())),
  );

  // Palette-import state, shared by the two sources: colors extracted from an
  // image, or parsed from a palette file (.ase/.gpl/.swatches). imageColors:
  // [{ hex, name?, selected }] shown in the preview modal. importSource picks
  // the modal wording; importSkipped counts entries a file parser could not
  // read. The two hidden <input type="file"> are opened by their buttons.
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageColors, setImageColors] = useState([]);
  const [imageError, setImageError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [importSource, setImportSource] = useState('image'); // 'image' | 'file'
  const [importSkipped, setImportSkipped] = useState(0);
  const [isDropActive, setIsDropActive] = useState(false);
  const fileInputRef = useRef(null);
  const paletteFileInputRef = useRef(null);

  useActiveProject(id);

  // Open the edit modal pre-filled from the color at the given index.
  const openEditModal = (idx) => {
    setEditIdx(idx);
    setEditColorName(palette[idx]?.name || '');
    setEditColorHex(palette[idx]?.hex || '');
  };

  // ColorInput reports a canonical '#RRGGBB' hex (valid) or null; store '' when
  // invalid so the save button and validity checks stay simple.
  const isValidEditHex = () => isValidHexValue(editColorHex);
  const isValidHex = () => isValidHexValue(newColorHex);

  const openAddModal = () => {
    setNewColorName('');
    setNewColorHex('');
    setIsAddingColor(true);
  };

  // Persist a color edit (the edited color keeps its id) and show status.
  const confirmEditColor = async () => {
    if (editIdx === null || !editColorName || !isValidEditHex()) return;
    const currentColor = palette[editIdx];
    if (!currentColor) return;

    const normalizedName = editColorName.trim();
    if (!normalizedName) return;

    const nextPalette = palette.map((color, idx) =>
      idx === editIdx ? { ...color, name: normalizedName, hex: editColorHex } : color,
    );

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

    const nextPalette = [...palette, { name: normalizedName, hex: newColorHex }];
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

  // Open the OS file picker to import a palette file (.ase/.gpl/.swatches).
  const openPaletteFilePicker = () => {
    setImageError('');
    paletteFileInputRef.current?.click();
  };

  // Extract dominant colors from an image, then open the preview modal.
  const processImageFile = async (file) => {
    setExtracting(true);
    setImageError('');
    try {
      const hexes = await extractColorsFromImage(file, 8);
      if (hexes.length === 0) {
        setImageError('No colors could be extracted from this image.');
        return;
      }
      setImageColors(hexes.map((hex) => ({ hex, selected: true })));
      setImportSource('image');
      setImportSkipped(0);
      setIsImageModalOpen(true);
    } catch {
      setImageError('This image could not be analyzed.');
    } finally {
      setExtracting(false);
    }
  };

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected later
    if (file) processImageFile(file);
  };

  // Parse a palette file (the mirror of the export formats), then open the
  // same preview modal — imported colors keep the names the file carries.
  const processPaletteFile = async (file) => {
    setImageError('');
    try {
      const { colors, skipped } = await parsePaletteFile(file);
      if (colors.length === 0) {
        setImageError('No colors found in this file.');
        return;
      }
      setImageColors(colors.map(({ hex, name }) => ({ hex, name, selected: true })));
      setImportSource('file');
      setImportSkipped(skipped);
      setIsImageModalOpen(true);
    } catch (error) {
      setImageError(error?.message || 'This file could not be read.');
    }
  };

  const handlePaletteFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected later
    if (file) processPaletteFile(file);
  };

  // Drag-and-drop: a palette file or an image dropped anywhere on the page
  // routes to the matching import flow (buttons remain the accessible path).
  const isPaletteFileName = (name) => /\.(ase|gpl|swatches)$/i.test(String(name || ''));
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDropActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (isPaletteFileName(file.name)) {
      processPaletteFile(file);
    } else if (file.type?.startsWith('image/')) {
      processImageFile(file);
    } else {
      setImageError('Unsupported file type — use .ase, .gpl, .swatches or an image.');
    }
  };

  // Toggle (by index: an imported file may legitimately repeat a hex) whether
  // a previewed color will be added to the palette.
  const toggleImageColor = (index) => {
    setImageColors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c)),
    );
  };

  // Append the selected colors (capped at MAX_PALETTE_SIZE) and persist.
  // Imported colors keep their file-given name; unnamed ones get "Color N".
  const confirmAddImageColors = async () => {
    const chosen = imageColors.filter((c) => c.selected);
    if (chosen.length === 0) return;

    const room = Math.max(0, MAX_PALETTE_SIZE - palette.length);
    if (room === 0) {
      setImageError(`The palette is full (maximum ${MAX_PALETTE_SIZE} colors).`);
      return;
    }

    const toAdd = chosen.slice(0, room).map((c, i) => ({
      name: (c.name || '').trim().slice(0, 255) || `Color ${palette.length + i + 1}`,
      hex: c.hex,
    }));

    const saved = await persistPalette([...palette, ...toAdd]);
    if (saved) {
      setIsImageModalOpen(false);
      setImageColors([]);
      showToast(`${toAdd.length} color${toAdd.length > 1 ? 's' : ''} added.`);
    }
  };

  // Color-harmony generator: pick a base color, preview complementary/analogous/
  // triad suggestions, and add the ones you like (same select-then-add flow as
  // the image/file import above).
  const [isHarmoniesOpen, setIsHarmoniesOpen] = useState(false);
  const [harmonyBaseHex, setHarmonyBaseHex] = useState('');
  const [selectedHarmonyKeys, setSelectedHarmonyKeys] = useState(() => new Set());

  const openHarmonies = () => {
    // Seed from the first palette color when there is one, else a pleasant default.
    setHarmonyBaseHex(palette[0]?.hex || '#8994DF');
    setSelectedHarmonyKeys(new Set());
    setIsHarmoniesOpen(true);
  };

  // Recomputed from the (valid) base color; empty while the base isn't valid.
  const harmonyGroups = isValidHexValue(harmonyBaseHex) ? generateHarmonies(harmonyBaseHex) : [];

  const toggleHarmony = (key) =>
    setSelectedHarmonyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // The { name, hex } of every currently-ticked suggestion, in display order.
  const selectedHarmonyColors = harmonyGroups.flatMap((group) =>
    group.colors
      .map((color, index) => ({ color, key: `${group.id}-${index}` }))
      .filter(({ key }) => selectedHarmonyKeys.has(key))
      .map(({ color }) => color),
  );

  const confirmAddHarmonies = async () => {
    if (selectedHarmonyColors.length === 0) return;
    const room = Math.max(0, MAX_PALETTE_SIZE - palette.length);
    if (room === 0) {
      showToast(`The palette is full (maximum ${MAX_PALETTE_SIZE} colors).`, 'danger');
      return;
    }
    const toAdd = selectedHarmonyColors.slice(0, room).map((c) => ({ name: c.name, hex: c.hex }));
    const saved = await persistPalette([...palette, ...toAdd]);
    if (saved) {
      setIsHarmoniesOpen(false);
      showToast(`${toAdd.length} color${toAdd.length > 1 ? 's' : ''} added.`);
    }
  };

  // Duplicate a single color: drop a copy ("<name> (copy)", same hex) right
  // after the original, then persist the whole palette. Capped like every add.
  const handleDuplicateColor = async (e, idx) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (palette.length >= MAX_PALETTE_SIZE) {
      showToast(`The palette is full (maximum ${MAX_PALETTE_SIZE} colors).`, 'danger');
      return;
    }
    const original = palette[idx];
    if (!original) return;
    const copy = {
      name: `${original.name || 'Color'} (copy)`.slice(0, 255),
      hex: original.hex,
    };
    const next = [...palette.slice(0, idx + 1), copy, ...palette.slice(idx + 1)];
    const saved = await persistPalette(next);
    if (saved) showToast('Color duplicated.');
  };

  // Stage a color for deletion (by id). stopImmediatePropagation also prevents
  // sibling handlers (copy/drag) on the same swatch from firing.
  const handleDeleteColor = (e, colorId) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setConfirmDeleteColor(colorId);
  };

  return (
    <>
      <Seo title="Color palette" noindex />
      <PageHeader
        title="Color palette"
        subtitle="This project's reference colors."
        actions={
          activeProject ? (
            <div className="flex flex-wrap gap-2 justify-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelected}
                className="hidden"
              />
              <input
                ref={paletteFileInputRef}
                type="file"
                accept=".ase,.gpl,.swatches"
                onChange={handlePaletteFileSelected}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={openHarmonies}>
                Harmonies
              </Button>
              <Button type="button" variant="outline" onClick={openPaletteFilePicker}>
                Import a palette
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openImagePicker}
                disabled={extracting}
              >
                {extracting ? 'Analyzing…' : 'Palette from an image'}
              </Button>
            </div>
          ) : null
        }
      />

      {activeProject ? (
        /* Dropping a palette file or an image anywhere on the page imports it;
           the ring highlights the page while a compatible drag hovers it. */
        <div
          data-testid="palette-dropzone"
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
              setIsDropActive(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setIsDropActive(false);
          }}
          onDrop={handleDrop}
          className={`rounded-3xl transition-shadow ${isDropActive ? 'ring-2 ring-blue ring-offset-4 ring-offset-canvas' : ''}`}
        >
          {imageError && !isImageModalOpen && (
            <p className="text-xs text-danger mb-4 text-right">{imageError}</p>
          )}

          {/* Display-format switcher: changes how every swatch's value is shown
              (the stored colors are untouched). Shown once there's a color. */}
          {previewPalette.length > 0 && (
            <div className="mb-4 flex items-center justify-end gap-2">
              <span className="text-xs text-primary/50">Show as</span>
              <ColorFormatToggle value={displayFormat} onChange={setDisplayFormat} />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            <AddTile onClick={openAddModal} label="New color" className="aspect-square" />

            {/* Live (preview) order; each node is registered by id for FLIP
              measurement, and the dragged swatch is dimmed. Only the color
              square is the drag handle (see ColorTile), so the caption stays
              clickable/focusable. */}
            {previewPalette.map((color, idx) => {
              // Clicking the swatch copies what's on screen (the display format),
              // so "what you see is what you copy" stays true in any format.
              const shownValue = formatColor(color.hex, displayFormat);
              return (
                <ColorTile
                  key={color.id}
                  ref={registerItemRef(color.id)}
                  tabIndex={-1}
                  aria-label={`Color ${color.name}, ${color.hex}`}
                  {...getRevealProps(color.id)}
                  hex={color.hex}
                  name={color.name}
                  displayFormat={displayFormat}
                  onCopy={(e) => handleCopyHex(e, shownValue)}
                  copied={copiedValue === shownValue}
                  onCopyValue={copy}
                  copiedValue={copiedValue}
                  className={color.id === draggedId ? 'opacity-30 z-40' : ''}
                  dragHandleProps={getDragHandlers(color, idx)}
                  dragging={color.id === draggedId}
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

                      <ActionIconButton
                        onClick={(e) => handleDuplicateColor(e, idx)}
                        title="Duplicate color"
                        intent="edit"
                        variant="light"
                        // top-14 clears the edit button above it at its normal 36px
                        // size, but touch devices grow that button to 44px (see
                        // ActionIconButton), which closes the gap to zero; push
                        // this one down to match on hover:none.
                        className="absolute top-14 [@media(hover:none)]:top-16 left-3 z-30"
                      >
                        <DuplicateIcon />
                      </ActionIconButton>

                      {/* Reorder controls: keyboard-operable, non-drag alternative
                      (WCAG 2.5.7). Visually hidden (srOnly) so sighted users
                      drag while assistive-tech users get "move left/right". */}
                      <div className="absolute bottom-3 inset-x-3 flex justify-between z-30">
                        <ActionIconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            moveColor(idx, idx - 1);
                          }}
                          title="Move color left"
                          variant="light"
                          srOnly
                          disabled={idx === 0}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </ActionIconButton>
                        <ActionIconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            moveColor(idx, idx + 1);
                          }}
                          title="Move color right"
                          variant="light"
                          srOnly
                          disabled={idx === previewPalette.length - 1}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </ActionIconButton>
                      </div>
                    </>
                  }
                />
              );
            })}
          </div>

          {trashedPaletteColors.length > 0 && (
            <TrashSection
              id="palette-trash-title"
              count={trashedPaletteColors.length}
              note="Deleted colors are kept for 30 days, then deleted forever."
            >
              {trashedPaletteColors.map((color) => (
                <TrashRow
                  key={color.id}
                  leading={
                    <div
                      className="w-8 h-8 rounded-full ring-2 ring-surface shrink-0"
                      style={{ backgroundColor: color.hex }}
                    ></div>
                  }
                  title={color.name}
                  daysLeft={color.daysLeft}
                  onRestore={() => handleRestoreColor(color.id)}
                  restoring={restoringColorId === color.id}
                  busy={trashBusy}
                  onDeleteForever={() =>
                    setConfirmPermanentDeleteColor({ id: color.id, name: color.name })
                  }
                />
              ))}
            </TrashSection>
          )}
        </div>
      ) : (
        <ProjectStatePlaceholder
          // Stay in the loading state until the deep-link lookup has actually
          // failed: a project beyond the loaded pages is fetched by id first.
          loading={
            projectsLoading || String(activeProjectId) !== String(id) || !activeProjectNotFound
          }
        />
      )}

      <FormModal isOpen={editIdx !== null} onClose={() => setEditIdx(null)} title="Edit color">
        <div className="space-y-4">
          <FormField label="Color usage">
            <TextInput
              type="text"
              value={editColorName}
              onChange={(e) => setEditColorName(e.target.value)}
              placeholder="Hair highlight"
            />
          </FormField>
          {/* Enter the color in whichever format you like; the input defaults
              to the palette's current display format. */}
          <ColorInput
            label="Color"
            initialHex={palette[editIdx]?.hex || ''}
            initialFormat={displayFormat}
            onChange={(hex) => setEditColorHex(hex || '')}
          />
          {(() => {
            // Heads-up, not a blocker: a duplicate color can be deliberate.
            const duplicate = findDuplicateColor(palette, editColorHex, {
              excludeId: palette[editIdx]?.id,
            });
            return duplicate ? (
              <Alert variant="info">
                &ldquo;{duplicate.name}&rdquo; already uses this color — you can still save it.
              </Alert>
            ) : null;
          })()}
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Save"
          onSecondary={() => setEditIdx(null)}
          onPrimary={confirmEditColor}
          primaryDisabled={!editColorName || !isValidEditHex()}
        />
      </FormModal>

      <FormModal isOpen={isAddingColor} onClose={() => setIsAddingColor(false)} title="New color">
        <div className="space-y-4">
          <FormField label="Color usage">
            <TextInput
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Hair highlight"
            />
          </FormField>

          {/* Enter the color in whichever format you like; the input defaults
              to the palette's current display format. */}
          <ColorInput
            label="Color"
            initialFormat={displayFormat}
            onChange={(hex) => setNewColorHex(hex || '')}
          />
          {(() => {
            // Heads-up, not a blocker: a duplicate color can be deliberate.
            const duplicate = findDuplicateColor(palette, newColorHex);
            return duplicate ? (
              <Alert variant="info">
                &ldquo;{duplicate.name}&rdquo; already uses this color — you can still add it.
              </Alert>
            ) : null;
          })()}
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
        onClose={() => {
          setIsImageModalOpen(false);
          setImageColors([]);
        }}
        title={importSource === 'file' ? 'Import a palette' : 'Palette from an image'}
      >
        <div className="space-y-4">
          <p className="text-sm text-primary">
            {importSource === 'file'
              ? 'Colors found in the file — click to select or deselect the ones to add.'
              : 'Colors extracted from the image — click to select or deselect the ones to add.'}
          </p>
          {importSkipped > 0 && (
            <p className="text-xs text-primary/60">
              {importSkipped} entr{importSkipped > 1 ? 'ies' : 'y'} in this file could not be read
              and {importSkipped > 1 ? 'were' : 'was'} skipped.
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {imageColors.map(({ hex, name, selected }, index) => (
              <button
                type="button"
                key={`${hex}-${index}`}
                onClick={() => toggleImageColor(index)}
                aria-pressed={selected}
                aria-label={`${name || hex}, ${hex}`}
                className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${selected ? 'ring-2 ring-blue/40' : 'opacity-50 hover:opacity-100'}`}
              >
                <span className="w-full h-12 rounded-lg" style={{ backgroundColor: hex }}></span>
                {name ? (
                  <span className="max-w-full truncate text-xs font-medium text-primary">
                    {name}
                  </span>
                ) : null}
                <span className="text-xs font-mono text-primary uppercase">{hex}</span>
              </button>
            ))}
          </div>
          {imageError && <p className="text-xs text-danger">{imageError}</p>}
          {(() => {
            // Heads-up, not a blocker: imported colors can duplicate the palette.
            const duplicateCount = imageColors.filter(
              (c) => c.selected && findDuplicateColor(palette, c.hex),
            ).length;
            return duplicateCount > 0 ? (
              <Alert variant="info">
                {duplicateCount === 1
                  ? '1 selected color is already in the palette — you can still add it.'
                  : `${duplicateCount} selected colors are already in the palette — you can still add them.`}
              </Alert>
            ) : null;
          })()}
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel={`Add (${imageColors.filter((c) => c.selected).length})`}
          onSecondary={() => {
            setIsImageModalOpen(false);
            setImageColors([]);
          }}
          onPrimary={confirmAddImageColors}
          primaryDisabled={imageColors.filter((c) => c.selected).length === 0}
        />
      </FormModal>

      <FormModal
        isOpen={isHarmoniesOpen}
        onClose={() => setIsHarmoniesOpen(false)}
        title="Color harmonies"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary">
            Pick a base color; select the suggestions you want to add.
          </p>
          <ColorInput
            label="Base color"
            initialHex={harmonyBaseHex}
            initialFormat={displayFormat}
            onChange={(hex) => {
              setHarmonyBaseHex(hex || '');
              // The suggestions change with the base, so drop any stale ticks.
              setSelectedHarmonyKeys(new Set());
            }}
          />

          {harmonyGroups.length > 0 ? (
            <div className="space-y-4">
              {harmonyGroups.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary/50">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {group.colors.map((color, index) => {
                      const key = `${group.id}-${index}`;
                      const selected = selectedHarmonyKeys.has(key);
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => toggleHarmony(key)}
                          aria-pressed={selected}
                          aria-label={`${color.name}, ${color.hex}`}
                          className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${
                            selected ? 'ring-2 ring-blue/40' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <span
                            className="h-12 w-full rounded-lg"
                            style={{ backgroundColor: color.hex }}
                          ></span>
                          <span className="text-xs font-mono uppercase text-primary">
                            {formatColor(color.hex, displayFormat)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-primary/50">
              Enter a valid color above to see its harmonies.
            </p>
          )}
          {(() => {
            // Heads-up, not a blocker: a suggestion can duplicate the palette
            // (e.g. the base color's complementary is already in it).
            const duplicateCount = selectedHarmonyColors.filter((color) =>
              findDuplicateColor(palette, color.hex),
            ).length;
            return duplicateCount > 0 ? (
              <Alert variant="info">
                {duplicateCount === 1
                  ? '1 selected color is already in the palette — you can still add it.'
                  : `${duplicateCount} selected colors are already in the palette — you can still add them.`}
              </Alert>
            ) : null;
          })()}
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel={`Add (${selectedHarmonyColors.length})`}
          onSecondary={() => setIsHarmoniesOpen(false)}
          onPrimary={confirmAddHarmonies}
          primaryDisabled={selectedHarmonyColors.length === 0}
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
