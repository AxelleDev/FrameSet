/**
 * Project norms page (route: /app/project/:id/norms).
 *
 * Lets the user define the project's graphic norms in two categories:
 *   - Brush norms (usage, brush name, size/unit, opacity).
 *   - Typography norms (Google Font family, weight, usage, style).
 * Norms can be added, edited, deleted and filtered by type. Typography norms
 * are previewed in their actual font, which requires dynamically loading the
 * Google Font (see the effect below).
 */
import React, { useState, useRef } from 'react';
import CustomSelect from '../components/CustomSelect';
import FontFaceObserver from 'fontfaceobserver';
import useGoogleFonts from '../hooks/useGoogleFonts';
import { loadGoogleFont } from '../utils/loadGoogleFont';
import useFormState from '../hooks/useFormState';
import useActiveProject from '../hooks/useActiveProject';
import { useProjects } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import Badge from '../components/Badge';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import ProjectStatePlaceholder from '../components/ProjectStatePlaceholder';

export default function ProjectNorms() {
  const { id } = useParams();
  const {
    activeProject,
    projectsLoading,
    activeProjectId,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  } = useProjects();
  const { showToast } = useToast();

  const [editingNorm, setEditingNorm] = useState(null);
  const [editingType, setEditingType] = useState('brush');

  const { values: brushForm, setValues: setBrushForm, setField: setBrushField, reset: resetBrushForm } = useFormState({ usage: '', name: '', value: '', unit: 'px', opacity: '' });
  const { values: typoForm, setValues: setTypoForm, setField: setTypoField, reset: resetTypoForm } = useFormState({ fontFamily: '', fontWeight: '', fontUsage: '', fontStyle: '' });

  // Brush form validation: the size must be a positive number (<= 1000) and the
  // opacity, when provided, must be between 0 and 1. Gates the submit buttons so
  // invalid values never reach the API.
  const brushValueNum = parseFloat(brushForm.value);
  const isBrushValueValid = brushForm.value !== '' && Number.isFinite(brushValueNum) && brushValueNum > 0 && brushValueNum <= 1000;
  const opacityNum = parseFloat(brushForm.opacity);
  const isOpacityValid = brushForm.opacity === '' || (Number.isFinite(opacityNum) && opacityNum >= 0 && opacityNum <= 1);
  const isBrushFormValid = !!brushForm.usage && isBrushValueValid && isOpacityValid;

  // loadedFonts: families whose web font has finished loading (drives the
  // preview switch from "Loading…" to the rendered AaBbCc sample).
  // loadingFontsRef: families currently being loaded, kept in a ref so it does
  // not retrigger this effect and to dedupe concurrent loads.
  const [loadedFonts, setLoadedFonts] = useState([]);
  const loadingFontsRef = useRef({});

    // For each typography norm, dynamically load its Google Font so the preview
    // can render in the real typeface, then mark it as loaded. Each family is
    // loaded at most once.
    React.useEffect(() => {
      if (activeProject?.typographyNorms) {
        activeProject.typographyNorms.forEach(async norm => {
          // Dedupe via the ref only: it is set on first sight and never cleared,
          // so a family is loaded at most once without depending on loadedFonts.
          if (norm.fontFamily && !loadingFontsRef.current[norm.fontFamily]) {
            loadingFontsRef.current[norm.fontFamily] = true;
            try {
              // Look up the font's metadata in the Google Fonts catalog.
              const fontMeta = (googleFonts || []).find(f => f.family === norm.fontFamily);
              let fontWeight = norm.fontWeight || '400';
              let availableWeights = [];
              if (fontMeta && fontMeta.variants) {
                // Extract the numeric weights from variant labels (e.g. 'regular',
                // '700italic', '400'), deduplicated.
                availableWeights = fontMeta.variants
                  .map(v => v.replace(/[^0-9]/g, '') || '400')
                  .filter((v, i, arr) => arr.indexOf(v) === i); // unique
              }
              // Fall back to an available weight (or 400) if the requested one is missing.
              if (availableWeights.length === 0) {
                fontWeight = '400';
              } else if (!availableWeights.includes(fontWeight)) {
                fontWeight = availableWeights[0] || '400';
              }
              // Inject the stylesheet; loadGoogleFont may return a promise to await.
              const maybePromise = loadGoogleFont(norm.fontFamily, fontWeight);
              if (maybePromise && typeof maybePromise.then === 'function') {
                await maybePromise;
              }
              // Wait until the font is actually usable. Omit the weight option when
              // no weights were resolved so FontFaceObserver does not over-constrain.
              const fontObserverOpts = availableWeights.length > 0 ? { weight: fontWeight } : {};
              const font = new FontFaceObserver(norm.fontFamily, fontObserverOpts);
              await font.load(null, 5000); // give up after 5s
              setLoadedFonts(prev => [...prev, norm.fontFamily]);
            } catch (e) {
              // On timeout/failure still mark as loaded so the UI stops waiting
              // (the preview falls back to the system font).
              setLoadedFonts(prev => [...prev, norm.fontFamily]);
            }
          }
        });
      }
      // loadedFonts is intentionally excluded so the effect does not re-run (and
      // re-iterate every norm) each time a single font finishes loading; the ref
      // guard handles dedup. googleFonts is likewise excluded (static metadata).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProject?.typographyNorms]);
  // Google Fonts catalog used to populate the font picker and resolve weights.
  const GOOGLE_FONTS_API_KEY = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
  const { fonts: googleFonts, loading: loadingFonts, error: errorFonts } = useGoogleFonts(GOOGLE_FONTS_API_KEY);

  // Open the edit modal pre-filled from the selected norm (per its type).
  const openEditNorm = (norm, type) => {
    setEditingNorm(norm);
    setEditingType(type);
    if (type === 'brush') {
      setBrushForm({ usage: norm.name, name: norm.brushName || '', value: norm.value, unit: norm.unit || 'px', opacity: norm.opacity ?? '' });
    } else {
      setTypoForm({ fontFamily: norm.fontFamily, fontWeight: norm.fontWeight || '', fontUsage: norm.fontUsage || '', fontStyle: norm.fontStyle || '' });
    }
  };

  // Persist edits for the norm currently open in the edit modal.
  const handleEditNorm = async () => {
    if (!id || !editingNorm) return;
    if (editingType === 'brush') {
      if (!isBrushFormValid) return;
      await updateBrushNorm(id, editingNorm.id, {
        name: brushForm.usage,
        value: brushForm.value,
        unit: brushForm.unit,
        brushName: brushForm.name,
        opacity: brushForm.opacity
      });
    } else {
      await updateTypographyNorm(id, editingNorm.id, {
        fontFamily: typoForm.fontFamily,
        fontWeight: typoForm.fontWeight,
        fontUsage: typoForm.fontUsage,
        fontStyle: typoForm.fontStyle
      });
    }
    setEditingNorm(null);
    showToast('Standard updated.');
  };

  // loadingDelete holds the id of the norm whose deletion spinner is showing.
  const [loadingDelete, setLoadingDelete] = useState(null);
  const [confirmDeleteNorm, setConfirmDeleteNorm] = useState(null);
  // Stage a norm for deletion (actual delete runs from the confirm dialog).
  const handleDeleteNorm = async (e, normId, type) => {
    e.preventDefault();
    if (!id || !normId) return;
    setConfirmDeleteNorm({ id: normId, type });
  };

  const [isAddingNorm, setIsAddingNorm] = useState(false);
  const [addType, setAddType] = useState('brush');

  useActiveProject(id);

  // Reset both add/edit form states.
  const resetForm = () => {
    resetBrushForm();
    resetTypoForm();
  };

  // Create a norm of the currently selected type from the add modal. For
  // typography, eagerly load the chosen font so its preview appears immediately.
  const handleAddNorm = async () => {
    if (!id) return;
    if (addType === 'brush') {
      if (!isBrushFormValid) return;
      await addBrushNorm(id, {
        name: brushForm.usage,
        value: brushForm.value,
        unit: brushForm.unit,
        brushName: brushForm.name,
        opacity: brushForm.opacity
      });
    } else {
      if (!typoForm.fontFamily) return;
      // Preload the font (prefer the 'regular'/400 variant, else the first one).
      const selectedFont = googleFonts.find(f => f.family === typoForm.fontFamily);
      if (selectedFont) {
        loadGoogleFont(selectedFont.family, selectedFont.variants?.includes('regular') ? '400' : selectedFont.variants?.[0] || '400');
      }
      await addTypographyNorm(id, {
        fontFamily: typoForm.fontFamily,
        fontWeight: typoForm.fontWeight,
        fontUsage: typoForm.fontUsage,
        fontStyle: typoForm.fontStyle
      });
    }
    setIsAddingNorm(false);
    resetForm();
    showToast('Standard added.');
  };

  // Display filter: 'all', 'brush', or 'typography'.
  const [filterType, setFilterType] = useState('all');

  return (
    <>
      <PageHeader
        title="Graphic standards"
        subtitle="This project's graphic rules, all in one place."
        subtitleClassName="max-w-xl"
        actions={
          <div className="w-44 sm:w-48">
            <CustomSelect
              value={filterType}
              onChange={val => setFilterType(val)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'brush', label: 'Brush' },
                { value: 'typography', label: 'Typography' }
              ]}
              placeholder="Filter…"
              isSearchable={false}
            />
          </div>
        }
      />

      {activeProject ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AddTile
              onClick={() => { resetForm(); setAddType('brush'); setIsAddingNorm(true); }}
              className="min-h-[260px]"
            />
            {/* Brush norm cards (hidden when filtering to typography only) */}
            {filterType !== 'typography' && activeProject.brushNorms && activeProject.brushNorms.map((norm) => (
              <Card key={norm.id} clickable className="p-6 relative group flex flex-col justify-between h-full">
                <div className="absolute top-3 right-3 flex gap-2 z-30">
                  <ActionIconButton
                    onClick={() => openEditNorm(norm, 'brush')}
                    title="Edit standard"
                    intent="edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                    </svg>
                  </ActionIconButton>
                  <ActionIconButton
                    onClick={(e) => handleDeleteNorm(e, norm.id, 'brush')}
                    title="Delete standard"
                    intent="delete"
                  >
                    {loadingDelete === norm.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </ActionIconButton>
                </div>
                <div className="mb-4">
                  <Badge color="primary" className="mb-2">Brush</Badge>
                  <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{norm.name}</h3>
                  <div className="flex items-baseline mb-2">
                    <span className="text-2xl font-light text-primary mr-1">{norm.value}</span>
                    <span className="text-base text-blue font-medium">{norm.unit}</span>
                  </div>
                  <div className="text-xs text-secondary mb-2">Opacity: {typeof norm.opacity === 'number' ? norm.opacity : (norm.opacity ?? '—')}</div>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div className="h-16 bg-blue/5 rounded-xl flex items-center justify-center relative overflow-hidden">
                    <div className="flex flex-col items-center justify-center w-full px-4">
                      <div
                        className="w-16 rounded-full mb-1 bg-primary"
                        style={{
                          height: `${norm.value}px`,
                          minHeight: '1px',
                          backgroundColor: 'rgb(var(--color-primary))',
                          opacity: typeof norm.opacity === 'number' ? norm.opacity : (norm.opacity ? parseFloat(norm.opacity) : 1)
                        }}
                      ></div>
                      <span className="text-[10px] text-blue font-bold uppercase tracking-wider">{norm.brushName || 'Brush'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {/* Typography norm cards (hidden when filtering to brush only) */}
            {filterType !== 'brush' && activeProject.typographyNorms && activeProject.typographyNorms.map((norm) => (
              <Card key={norm.id} clickable className="p-6 relative group flex flex-col justify-between h-full">
                <div className="absolute top-3 right-3 flex gap-2 z-30">
                  <ActionIconButton
                    onClick={() => openEditNorm(norm, 'typography')}
                    title="Edit standard"
                    intent="edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                    </svg>
                  </ActionIconButton>
                  <ActionIconButton
                    onClick={(e) => handleDeleteNorm(e, norm.id, 'typography')}
                    title="Delete standard"
                    intent="delete"
                  >
                    {loadingDelete === norm.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </ActionIconButton>
                </div>
                <div className="mb-4">
                  <Badge color="blue" className="mb-2">Typography</Badge>
                  <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{norm.fontUsage || norm.fontFamily}</h3>
                  <div className="flex items-baseline mb-2 min-w-0">
                    <span className="text-2xl font-light text-primary mr-1 truncate min-w-0" title={norm.fontFamily}>{norm.fontFamily}</span>
                    <span className="text-base text-blue font-medium shrink-0">{norm.fontWeight}</span>
                  </div>
                  {norm.fontStyle && (
                    <div className="mb-2">
                      <span className="text-xs text-primary italic">{norm.fontStyle}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div className="h-16 bg-blue/5 rounded-xl flex items-center justify-center relative overflow-hidden">
                    {/* Show the live font sample only once the font has loaded */}
                    {loadedFonts.includes(norm.fontFamily) ? (
                      <span
                        className="text-primary text-xl font-medium tracking-tight"
                        style={{ fontFamily: `'${norm.fontFamily}', Arial, sans-serif`, fontStyle: norm.fontStyle ? norm.fontStyle.toLowerCase() : undefined }}
                        title={norm.fontFamily}
                      >
                        AaBbCc
                      </span>
                    ) : (
                      <span className="text-xs text-secondary">Loading… <span style={{fontFamily: `'${norm.fontFamily}', Arial, sans-serif`}}>{norm.fontFamily}</span></span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <FormModal
            isOpen={!!editingNorm}
            onClose={() => setEditingNorm(null)}
            title="Edit standard"
          >
            <div className="space-y-4">
              {editingType === 'brush' ? (
                <>
                  <FormField label="Brush usage">
                    <TextInput type="text" value={brushForm.usage} onChange={e => setBrushField('usage', e.target.value)} placeholder="Hair outline" />
                  </FormField>
                  <FormField label="Brush name">
                    <TextInput type="text" value={brushForm.name} onChange={e => setBrushField('name', e.target.value)} placeholder="Plume G" />
                  </FormField>
                  <FormField label="Size">
                    <TextInput type="number" min="0" step="0.1" value={brushForm.value} onChange={e => setBrushField('value', e.target.value)} placeholder="8" />
                    {brushForm.value !== '' && !isBrushValueValid && <p className="text-xs text-danger mt-1">Size must be a positive number (≤ 1000).</p>}
                  </FormField>
                  <FormField label="Unit">
                    <TextInput type="text" value={brushForm.unit} onChange={e => setBrushField('unit', e.target.value)} placeholder="px" />
                  </FormField>
                  <FormField label="Opacity (0 to 1)">
                    <TextInput type="number" step="0.01" min={0} max={1} value={brushForm.opacity} onChange={e => setBrushField('opacity', e.target.value)} placeholder="1.0" />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label="Font">
                    <div className="relative">
                      <CustomSelect
                        value={typoForm.fontFamily}
                        onChange={val => {
                          setTypoField('fontFamily', val);
                          const selectedFont = googleFonts.find(f => f.family === val);
                          if (selectedFont) {
                            loadGoogleFont(selectedFont.family, selectedFont.variants?.includes('regular') ? '400' : selectedFont.variants?.[0] || '400');
                          }
                        }}
                        options={googleFonts ? googleFonts.map(font => ({ value: font.family, label: font.family })) : []}
                        placeholder="Select a font"
                        isLoading={loadingFonts}
                        isDisabled={loadingFonts}
                        noOptionsMessage={() => loadingFonts ? 'Loading…' : 'No fonts'}
                      />
                    </div>
                    {loadingFonts && <div className="text-xs text-secondary mt-1">Loading fonts…</div>}
                    {errorFonts && <div className="text-xs text-danger mt-1">Error loading fonts</div>}
                  </FormField>
                  <FormField label="Weight">
                    <TextInput type="text" value={typoForm.fontWeight} onChange={e => setTypoField('fontWeight', e.target.value)} placeholder="700" />
                  </FormField>
                  <FormField label="Usage">
                    <TextInput type="text" value={typoForm.fontUsage} onChange={e => setTypoField('fontUsage', e.target.value)} placeholder="Title" />
                  </FormField>
                  <FormField label="Style">
                    <TextInput type="text" value={typoForm.fontStyle} onChange={e => setTypoField('fontStyle', e.target.value)} placeholder="Italic" />
                  </FormField>
                </>
              )}
            </div>
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel="Save"
              onSecondary={() => setEditingNorm(null)}
              onPrimary={handleEditNorm}
              primaryDisabled={editingType === 'brush' ? !isBrushFormValid : !typoForm.fontFamily}
            />
          </FormModal>
        </>
      ) : (
        <ProjectStatePlaceholder loading={projectsLoading || String(activeProjectId) !== String(id)} />
      )}

      <FormModal
        isOpen={isAddingNorm}
        onClose={() => setIsAddingNorm(false)}
        title="New standard"
      >
        <div className="space-y-4">
          <FormField label="Type">
            <CustomSelect
              value={addType}
              onChange={val => setAddType(val)}
              options={[
                { value: 'brush', label: 'Brush' },
                { value: 'typography', label: 'Typography' }
              ]}
              isSearchable={false}
            />
          </FormField>
          {addType === 'brush' ? (
            <>
              <FormField label="Brush usage">
                <TextInput type="text" value={brushForm.usage} onChange={e => setBrushField('usage', e.target.value)} placeholder="Hair outline" />
              </FormField>
              <FormField label="Brush name">
                <TextInput type="text" value={brushForm.name} onChange={e => setBrushField('name', e.target.value)} placeholder="Plume G" />
              </FormField>
              <FormField label="Size (px)">
                <TextInput type="number" min="0" step="0.1" value={brushForm.value} onChange={e => setBrushField('value', e.target.value)} placeholder="8" />
                {brushForm.value !== '' && !isBrushValueValid && <p className="text-xs text-danger mt-1">Size must be a positive number (≤ 1000).</p>}
              </FormField>
              <FormField label="Unit">
                <TextInput type="text" value={brushForm.unit} onChange={e => setBrushField('unit', e.target.value)} placeholder="px" />
              </FormField>
              <FormField label="Opacity (0 to 1)">
                <TextInput type="number" step="0.01" min={0} max={1} value={brushForm.opacity} onChange={e => setBrushField('opacity', e.target.value)} placeholder="1.0" />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Font">
                <CustomSelect
                  value={typoForm.fontFamily}
                  onChange={val => {
                    setTypoField('fontFamily', val);
                    const selectedFont = googleFonts.find(f => f.family === val);
                    if (selectedFont) {
                      loadGoogleFont(selectedFont.family, selectedFont.variants?.includes('regular') ? '400' : selectedFont.variants?.[0] || '400');
                    }
                  }}
                  options={googleFonts ? googleFonts.map(font => ({ value: font.family, label: font.family })) : []}
                  placeholder="Select a font"
                  isLoading={loadingFonts}
                  isDisabled={loadingFonts}
                  noOptionsMessage={() => loadingFonts ? 'Loading…' : 'No fonts'}
                />
                {loadingFonts && <div className="text-xs text-secondary mt-1">Loading fonts…</div>}
                {errorFonts && <div className="text-xs text-danger mt-1">Error loading fonts</div>}
              </FormField>
              <FormField label="Weight">
                <TextInput type="text" value={typoForm.fontWeight} onChange={e => setTypoField('fontWeight', e.target.value)} placeholder="700" />
              </FormField>
              <FormField label="Usage">
                <TextInput type="text" value={typoForm.fontUsage} onChange={e => setTypoField('fontUsage', e.target.value)} placeholder="Title" />
              </FormField>
              <FormField label="Style">
                <TextInput type="text" value={typoForm.fontStyle} onChange={e => setTypoField('fontStyle', e.target.value)} placeholder="Italic" />
              </FormField>
            </>
          )}
        </div>
        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Add"
          onSecondary={() => setIsAddingNorm(false)}
          onPrimary={handleAddNorm}
          primaryDisabled={addType === 'brush' ? !isBrushFormValid : !typoForm.fontFamily}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteNorm}
        title="Delete standard?"
        message="This standard will be permanently deleted."
        confirmLabel="Delete"
       
        onCancel={() => setConfirmDeleteNorm(null)}
        onConfirm={async () => {
          if (!confirmDeleteNorm) return;
          // Show the spinner on the targeted card, delete by type, then clear state.
          setLoadingDelete(confirmDeleteNorm.id);
          if (confirmDeleteNorm.type === 'brush') {
            await deleteBrushNorm(id, confirmDeleteNorm.id);
          } else {
            await deleteTypographyNorm(id, confirmDeleteNorm.id);
          }
          setLoadingDelete(null);
          setConfirmDeleteNorm(null);
          showToast('Standard deleted.');
        }}
      />
    </>
  );
}