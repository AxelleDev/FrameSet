// Project norms page (/app/project/:id/norms): add/edit/delete/filter brush and
// typography norms. Typography previews load the real Google Font dynamically.
import React, { useState, useEffect } from 'react';
import CustomSelect from '../components/CustomSelect';
import useGoogleFonts from '../hooks/useGoogleFonts';
import useNormFontLoader from '../hooks/useNormFontLoader';
import { loadGoogleFont } from '../utils/loadGoogleFont';
import useFormState from '../hooks/useFormState';
import useActiveProject from '../hooks/useActiveProject';
import { useProjects } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import StandardCard from '../components/StandardCard';
import BrushPreview from '../components/BrushPreview';
import TypographyPreview from '../components/TypographyPreview';
import Spinner from '../components/Spinner';
import TrashSection from '../components/TrashSection';
import TrashRow from '../components/TrashRow';
import PageHeader from '../components/PageHeader';
import Seo from '../components/Seo';
import { EditIcon, DeleteIcon } from '../components/icons';
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
    updateTypographyNorm,
    trashedBrushNorms,
    trashedTypographyNorms,
    fetchTrashedBrushNorms,
    fetchTrashedTypographyNorms,
    restoreBrushNorm,
    restoreTypographyNorm,
    deleteBrushNormPermanently,
    deleteTypographyNormPermanently,
  } = useProjects();
  const { showToast } = useToast();

  // Load this project's trashed standards so its trash section can appear
  // (hidden when empty).
  useEffect(() => {
    if (id) {
      fetchTrashedBrushNorms(id, { silent: true });
      fetchTrashedTypographyNorms(id, { silent: true });
    }
  }, [id, fetchTrashedBrushNorms, fetchTrashedTypographyNorms]);

  // Trash: brush + typography trashed norms shown together, newest first, each
  // tagged with its type so the two dedicated restore/delete-forever actions
  // and endpoints can be called correctly. Mutually exclusive (trashBusy) so a
  // restore in flight and a "delete forever" can never race on the same
  // soft-deleted row.
  const trashedNorms = [
    ...trashedBrushNorms.map((norm) => ({ ...norm, type: 'brush', label: norm.name })),
    ...trashedTypographyNorms.map((norm) => ({
      ...norm,
      type: 'typography',
      label: norm.fontUsage || norm.fontFamily,
    })),
  ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  const [confirmPermanentDeleteNorm, setConfirmPermanentDeleteNorm] = useState(null);
  const [restoringNormKey, setRestoringNormKey] = useState(null);
  const trashNormBusy = restoringNormKey !== null || confirmPermanentDeleteNorm !== null;
  const handleRestoreNorm = async (norm) => {
    if (trashNormBusy) return;
    const key = `${norm.type}-${norm.id}`;
    setRestoringNormKey(key);
    try {
      const ok =
        norm.type === 'brush'
          ? await restoreBrushNorm(id, norm.id)
          : await restoreTypographyNorm(id, norm.id);
      if (ok) showToast('Standard restored.');
    } finally {
      setRestoringNormKey(null);
    }
  };

  const [editingNorm, setEditingNorm] = useState(null);
  const [editingType, setEditingType] = useState('brush');

  const {
    values: brushForm,
    setValues: setBrushForm,
    setField: setBrushField,
    reset: resetBrushForm,
  } = useFormState({ usage: '', name: '', value: '', unit: 'px', opacity: '' });
  const {
    values: typoForm,
    setValues: setTypoForm,
    setField: setTypoField,
    reset: resetTypoForm,
  } = useFormState({ fontFamily: '', fontWeight: '', fontUsage: '', fontStyle: '' });

  // Brush validation (gates submit): size a positive number <= 1000, and
  // opacity, when given, between 0 and 1.
  const brushValueNum = parseFloat(brushForm.value);
  const isBrushValueValid =
    brushForm.value !== '' &&
    Number.isFinite(brushValueNum) &&
    brushValueNum > 0 &&
    brushValueNum <= 1000;
  const opacityNum = parseFloat(brushForm.opacity);
  const isOpacityValid =
    brushForm.opacity === '' || (Number.isFinite(opacityNum) && opacityNum >= 0 && opacityNum <= 1);
  const isBrushFormValid = !!brushForm.usage && isBrushValueValid && isOpacityValid;

  // Google Fonts catalog (proxied by the backend) used to populate the font
  // picker and resolve weights.
  const { fonts: googleFonts, loading: loadingFonts, error: errorFonts } = useGoogleFonts();

  // Families whose web font has finished loading (switches each preview from
  // "Loading…" to the rendered sample). The hook re-resolves weights once the
  // catalog arrives, fixing norms that loaded before it was available.
  const loadedFonts = useNormFontLoader(activeProject?.typographyNorms, googleFonts);

  // Open the edit modal pre-filled from the selected norm (by type).
  const openEditNorm = (norm, type) => {
    setEditingNorm(norm);
    setEditingType(type);
    if (type === 'brush') {
      setBrushForm({
        usage: norm.name,
        name: norm.brushName || '',
        value: norm.value,
        unit: norm.unit || 'px',
        opacity: norm.opacity ?? '',
      });
    } else {
      setTypoForm({
        fontFamily: norm.fontFamily,
        fontWeight: norm.fontWeight || '',
        fontUsage: norm.fontUsage || '',
        fontStyle: norm.fontStyle || '',
      });
    }
  };

  // submitting guards both add and edit against a double submit.
  const [isSubmittingNorm, setIsSubmittingNorm] = useState(false);

  // Persist edits for the norm currently open in the edit modal. Only closes the
  // modal and confirms when the save actually succeeded.
  const handleEditNorm = async () => {
    if (!id || !editingNorm || isSubmittingNorm) return;
    setIsSubmittingNorm(true);
    try {
      let ok;
      if (editingType === 'brush') {
        if (!isBrushFormValid) return;
        ok = await updateBrushNorm(id, editingNorm.id, {
          name: brushForm.usage,
          value: brushForm.value,
          unit: brushForm.unit,
          brushName: brushForm.name,
          opacity: brushForm.opacity,
        });
      } else {
        ok = await updateTypographyNorm(id, editingNorm.id, {
          fontFamily: typoForm.fontFamily,
          fontWeight: typoForm.fontWeight,
          fontUsage: typoForm.fontUsage,
          fontStyle: typoForm.fontStyle,
        });
      }
      if (!ok) return;
      setEditingNorm(null);
      showToast('Standard updated.');
    } finally {
      setIsSubmittingNorm(false);
    }
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

  // Create a norm of the selected type. For typography, eagerly load the chosen
  // font so its preview appears immediately.
  const handleAddNorm = async () => {
    if (!id || isSubmittingNorm) return;
    setIsSubmittingNorm(true);
    try {
      let saved;
      if (addType === 'brush') {
        if (!isBrushFormValid) return;
        saved = await addBrushNorm(id, {
          name: brushForm.usage,
          value: brushForm.value,
          unit: brushForm.unit,
          brushName: brushForm.name,
          opacity: brushForm.opacity,
        });
      } else {
        if (!typoForm.fontFamily) return;
        // Preload the font (prefer the 'regular'/400 variant, else the first one).
        const selectedFont = googleFonts.find((f) => f.family === typoForm.fontFamily);
        if (selectedFont) {
          loadGoogleFont(
            selectedFont.family,
            selectedFont.variants?.includes('regular')
              ? '400'
              : selectedFont.variants?.[0] || '400',
          );
        }
        saved = await addTypographyNorm(id, {
          fontFamily: typoForm.fontFamily,
          fontWeight: typoForm.fontWeight,
          fontUsage: typoForm.fontUsage,
          fontStyle: typoForm.fontStyle,
        });
      }
      // Only close and confirm when the standard was actually saved.
      if (!saved) return;
      setIsAddingNorm(false);
      resetForm();
      showToast('Standard added.');
    } finally {
      setIsSubmittingNorm(false);
    }
  };

  // Display filter: 'all', 'brush', or 'typography'.
  const [filterType, setFilterType] = useState('all');

  return (
    <>
      <Seo title="Graphic standards" noindex />
      <PageHeader
        title="Graphic standards"
        subtitle="This project's graphic rules, all in one place."
        subtitleClassName="max-w-xl"
        actions={
          <div className="w-44 sm:w-48">
            <CustomSelect
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'brush', label: 'Brush' },
                { value: 'typography', label: 'Typography' },
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
              onClick={() => {
                resetForm();
                setAddType('brush');
                setIsAddingNorm(true);
              }}
              className="min-h-[260px]"
            />
            {/* Brush norm cards (hidden when filtering to typography only) */}
            {filterType !== 'typography' &&
              activeProject.brushNorms &&
              activeProject.brushNorms.map((norm) => (
                <StandardCard
                  key={norm.id}
                  category="Brush"
                  badgeColor="primary"
                  title={norm.name}
                  value={norm.value}
                  unit={norm.unit}
                  detail={
                    <div className="text-xs text-secondary mb-2">
                      Opacity:{' '}
                      {typeof norm.opacity === 'number' ? norm.opacity : (norm.opacity ?? '—')}
                    </div>
                  }
                  preview={
                    <BrushPreview
                      value={norm.value}
                      opacity={norm.opacity}
                      brushName={norm.brushName}
                    />
                  }
                  actions={
                    <div className="absolute top-3 right-3 flex gap-2 z-30">
                      <ActionIconButton
                        onClick={() => openEditNorm(norm, 'brush')}
                        title="Edit standard"
                        intent="edit"
                      >
                        <EditIcon />
                      </ActionIconButton>
                      <ActionIconButton
                        onClick={(e) => handleDeleteNorm(e, norm.id, 'brush')}
                        title="Delete standard"
                        intent="delete"
                      >
                        {loadingDelete === norm.id ? <Spinner size="sm" /> : <DeleteIcon />}
                      </ActionIconButton>
                    </div>
                  }
                />
              ))}
            {/* Typography norm cards (hidden when filtering to brush only) */}
            {filterType !== 'brush' &&
              activeProject.typographyNorms &&
              activeProject.typographyNorms.map((norm) => (
                <StandardCard
                  key={norm.id}
                  category="Typography"
                  badgeColor="blue"
                  title={norm.fontUsage || norm.fontFamily}
                  value={norm.fontFamily}
                  valueTitle={norm.fontFamily}
                  valueTruncate
                  unit={norm.fontWeight}
                  detail={
                    norm.fontStyle && (
                      <div className="mb-2">
                        <span className="text-xs text-primary italic">{norm.fontStyle}</span>
                      </div>
                    )
                  }
                  preview={
                    <TypographyPreview
                      fontFamily={norm.fontFamily}
                      fontStyle={norm.fontStyle}
                      loaded={loadedFonts.includes(norm.fontFamily)}
                    />
                  }
                  actions={
                    <div className="absolute top-3 right-3 flex gap-2 z-30">
                      <ActionIconButton
                        onClick={() => openEditNorm(norm, 'typography')}
                        title="Edit standard"
                        intent="edit"
                      >
                        <EditIcon />
                      </ActionIconButton>
                      <ActionIconButton
                        onClick={(e) => handleDeleteNorm(e, norm.id, 'typography')}
                        title="Delete standard"
                        intent="delete"
                      >
                        {loadingDelete === norm.id ? <Spinner size="sm" /> : <DeleteIcon />}
                      </ActionIconButton>
                    </div>
                  }
                />
              ))}
          </div>

          {trashedNorms.length > 0 && (
            <TrashSection
              id="norms-trash-title"
              count={trashedNorms.length}
              note="Deleted standards are kept for 30 days, then deleted forever."
            >
              {trashedNorms.map((norm) => {
                const key = `${norm.type}-${norm.id}`;
                return (
                  <TrashRow
                    key={key}
                    title={
                      <>
                        {norm.label}
                        <span className="ml-2 text-xs font-normal text-primary/50 uppercase tracking-wide">
                          {norm.type === 'brush' ? 'Brush' : 'Typography'}
                        </span>
                      </>
                    }
                    daysLeft={norm.daysLeft}
                    onRestore={() => handleRestoreNorm(norm)}
                    restoring={restoringNormKey === key}
                    busy={trashNormBusy}
                    onDeleteForever={() =>
                      setConfirmPermanentDeleteNorm({
                        id: norm.id,
                        type: norm.type,
                        label: norm.label,
                      })
                    }
                  />
                );
              })}
            </TrashSection>
          )}

          <FormModal
            isOpen={!!editingNorm}
            onClose={() => setEditingNorm(null)}
            title="Edit standard"
          >
            <div className="space-y-4">
              {editingType === 'brush' ? (
                <>
                  <FormField label="Brush usage">
                    <TextInput
                      type="text"
                      value={brushForm.usage}
                      onChange={(e) => setBrushField('usage', e.target.value)}
                      placeholder="Hair outline"
                    />
                  </FormField>
                  <FormField label="Brush name">
                    <TextInput
                      type="text"
                      value={brushForm.name}
                      onChange={(e) => setBrushField('name', e.target.value)}
                      placeholder="Plume G"
                    />
                  </FormField>
                  <FormField label="Size">
                    <TextInput
                      type="number"
                      min="0"
                      step="0.1"
                      value={brushForm.value}
                      onChange={(e) => setBrushField('value', e.target.value)}
                      placeholder="8"
                    />
                    {brushForm.value !== '' && !isBrushValueValid && (
                      <p className="text-xs text-danger mt-1">
                        Size must be a positive number (≤ 1000).
                      </p>
                    )}
                  </FormField>
                  <FormField label="Unit">
                    <TextInput
                      type="text"
                      value={brushForm.unit}
                      onChange={(e) => setBrushField('unit', e.target.value)}
                      placeholder="px"
                    />
                  </FormField>
                  <FormField label="Opacity (0 to 1)">
                    <TextInput
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      value={brushForm.opacity}
                      onChange={(e) => setBrushField('opacity', e.target.value)}
                      placeholder="1.0"
                    />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label="Font">
                    <div className="relative">
                      <CustomSelect
                        value={typoForm.fontFamily}
                        onChange={(val) => {
                          setTypoField('fontFamily', val);
                          const selectedFont = googleFonts.find((f) => f.family === val);
                          if (selectedFont) {
                            loadGoogleFont(
                              selectedFont.family,
                              selectedFont.variants?.includes('regular')
                                ? '400'
                                : selectedFont.variants?.[0] || '400',
                            );
                          }
                        }}
                        options={
                          googleFonts
                            ? googleFonts.map((font) => ({
                                value: font.family,
                                label: font.family,
                              }))
                            : []
                        }
                        placeholder="Select a font"
                        isLoading={loadingFonts}
                        isDisabled={loadingFonts}
                        noOptionsMessage={() => (loadingFonts ? 'Loading…' : 'No fonts')}
                      />
                    </div>
                    {loadingFonts && (
                      <div className="text-xs text-secondary mt-1">Loading fonts…</div>
                    )}
                    {errorFonts && (
                      <div className="text-xs text-danger mt-1">Error loading fonts</div>
                    )}
                  </FormField>
                  <FormField label="Weight">
                    <TextInput
                      type="text"
                      value={typoForm.fontWeight}
                      onChange={(e) => setTypoField('fontWeight', e.target.value)}
                      placeholder="700"
                    />
                  </FormField>
                  <FormField label="Usage">
                    <TextInput
                      type="text"
                      value={typoForm.fontUsage}
                      onChange={(e) => setTypoField('fontUsage', e.target.value)}
                      placeholder="Title"
                    />
                  </FormField>
                  <FormField label="Style">
                    <TextInput
                      type="text"
                      value={typoForm.fontStyle}
                      onChange={(e) => setTypoField('fontStyle', e.target.value)}
                      placeholder="Italic"
                    />
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
        <ProjectStatePlaceholder
          loading={projectsLoading || String(activeProjectId) !== String(id)}
        />
      )}

      <FormModal isOpen={isAddingNorm} onClose={() => setIsAddingNorm(false)} title="New standard">
        <div className="space-y-4">
          <FormField label="Type">
            <CustomSelect
              value={addType}
              onChange={(val) => setAddType(val)}
              options={[
                { value: 'brush', label: 'Brush' },
                { value: 'typography', label: 'Typography' },
              ]}
              isSearchable={false}
            />
          </FormField>
          {addType === 'brush' ? (
            <>
              <FormField label="Brush usage">
                <TextInput
                  type="text"
                  value={brushForm.usage}
                  onChange={(e) => setBrushField('usage', e.target.value)}
                  placeholder="Hair outline"
                />
              </FormField>
              <FormField label="Brush name">
                <TextInput
                  type="text"
                  value={brushForm.name}
                  onChange={(e) => setBrushField('name', e.target.value)}
                  placeholder="Plume G"
                />
              </FormField>
              <FormField label="Size (px)">
                <TextInput
                  type="number"
                  min="0"
                  step="0.1"
                  value={brushForm.value}
                  onChange={(e) => setBrushField('value', e.target.value)}
                  placeholder="8"
                />
                {brushForm.value !== '' && !isBrushValueValid && (
                  <p className="text-xs text-danger mt-1">
                    Size must be a positive number (≤ 1000).
                  </p>
                )}
              </FormField>
              <FormField label="Unit">
                <TextInput
                  type="text"
                  value={brushForm.unit}
                  onChange={(e) => setBrushField('unit', e.target.value)}
                  placeholder="px"
                />
              </FormField>
              <FormField label="Opacity (0 to 1)">
                <TextInput
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={brushForm.opacity}
                  onChange={(e) => setBrushField('opacity', e.target.value)}
                  placeholder="1.0"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Font">
                <CustomSelect
                  value={typoForm.fontFamily}
                  onChange={(val) => {
                    setTypoField('fontFamily', val);
                    const selectedFont = googleFonts.find((f) => f.family === val);
                    if (selectedFont) {
                      loadGoogleFont(
                        selectedFont.family,
                        selectedFont.variants?.includes('regular')
                          ? '400'
                          : selectedFont.variants?.[0] || '400',
                      );
                    }
                  }}
                  options={
                    googleFonts
                      ? googleFonts.map((font) => ({ value: font.family, label: font.family }))
                      : []
                  }
                  placeholder="Select a font"
                  isLoading={loadingFonts}
                  isDisabled={loadingFonts}
                  noOptionsMessage={() => (loadingFonts ? 'Loading…' : 'No fonts')}
                />
                {loadingFonts && <div className="text-xs text-secondary mt-1">Loading fonts…</div>}
                {errorFonts && <div className="text-xs text-danger mt-1">Error loading fonts</div>}
              </FormField>
              <FormField label="Weight">
                <TextInput
                  type="text"
                  value={typoForm.fontWeight}
                  onChange={(e) => setTypoField('fontWeight', e.target.value)}
                  placeholder="700"
                />
              </FormField>
              <FormField label="Usage">
                <TextInput
                  type="text"
                  value={typoForm.fontUsage}
                  onChange={(e) => setTypoField('fontUsage', e.target.value)}
                  placeholder="Title"
                />
              </FormField>
              <FormField label="Style">
                <TextInput
                  type="text"
                  value={typoForm.fontStyle}
                  onChange={(e) => setTypoField('fontStyle', e.target.value)}
                  placeholder="Italic"
                />
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
        title="Move to trash?"
        message="You can restore it for 30 days; after that it is deleted forever."
        confirmLabel="Move to trash"
        onCancel={() => setConfirmDeleteNorm(null)}
        onConfirm={async () => {
          if (!confirmDeleteNorm) return;
          // Show the spinner on the targeted card, delete by type, then clear state.
          setLoadingDelete(confirmDeleteNorm.id);
          const ok =
            confirmDeleteNorm.type === 'brush'
              ? await deleteBrushNorm(id, confirmDeleteNorm.id)
              : await deleteTypographyNorm(id, confirmDeleteNorm.id);
          setLoadingDelete(null);
          setConfirmDeleteNorm(null);
          // Only confirm when the deletion actually went through.
          if (ok) showToast('Standard moved to trash.');
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmPermanentDeleteNorm}
        title="Delete forever?"
        message={
          confirmPermanentDeleteNorm?.label
            ? `"${confirmPermanentDeleteNorm.label}" will be permanently lost. This cannot be undone.`
            : 'This standard will be permanently lost. This cannot be undone.'
        }
        confirmLabel="Delete forever"
        onCancel={() => setConfirmPermanentDeleteNorm(null)}
        onConfirm={async () => {
          if (!confirmPermanentDeleteNorm) return;
          const ok =
            confirmPermanentDeleteNorm.type === 'brush'
              ? await deleteBrushNormPermanently(id, confirmPermanentDeleteNorm.id)
              : await deleteTypographyNormPermanently(id, confirmPermanentDeleteNorm.id);
          setConfirmPermanentDeleteNorm(null);
          if (ok) showToast('Standard permanently deleted.');
        }}
      />
    </>
  );
}
