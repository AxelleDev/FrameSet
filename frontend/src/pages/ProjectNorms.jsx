import React, { useState } from 'react';
import useFormState from '../hooks/useFormState';
import useActiveProject from '../hooks/useActiveProject';
import { useProjects } from '../context/ProjectContext';
import { useParams } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

export default function ProjectNorms() {
  const { id } = useParams();
  const {
    activeProject,
    addBrushNorm,
    addTypographyNorm,
    deleteBrushNorm,
    deleteTypographyNorm,
    updateBrushNorm,
    updateTypographyNorm
  } = useProjects();

  const [editingNorm, setEditingNorm] = useState(null);
  const [editingType, setEditingType] = useState('brush');

  const { values: brushForm, setValues: setBrushForm, setField: setBrushField, reset: resetBrushForm } = useFormState({ usage: '', name: '', value: '', unit: 'px', opacity: '' });
  const { values: typoForm, setValues: setTypoForm, setField: setTypoField, reset: resetTypoForm } = useFormState({ fontFamily: '', fontWeight: '', fontUsage: '', fontStyle: '' });

  const openEditNorm = (norm, type) => {
    setEditingNorm(norm);
    setEditingType(type);
    if (type === 'brush') {
      setBrushForm({ usage: norm.name, name: norm.brushName || '', value: norm.value, unit: norm.unit || 'px', opacity: norm.opacity ?? '' });
    } else {
      setTypoForm({ fontFamily: norm.fontFamily, fontWeight: norm.fontWeight || '', fontUsage: norm.fontUsage || '', fontStyle: norm.fontStyle || '' });
    }
  };

  const handleEditNorm = async () => {
    if (!id || !editingNorm) return;
    if (editingType === 'brush') {
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
  };

  const [loadingDelete, setLoadingDelete] = useState(null);
  const [confirmDeleteNorm, setConfirmDeleteNorm] = useState(null);
  const handleDeleteNorm = async (e, normId, type) => {
    e.preventDefault();
    if (!id || !normId) return;
    setConfirmDeleteNorm({ id: normId, type });
  };

  const [isAddingNorm, setIsAddingNorm] = useState(false);
  const [addType, setAddType] = useState('brush');

  useActiveProject(id);

  const resetForm = () => {
    resetBrushForm();
    resetTypoForm();
  };

  const handleAddNorm = async () => {
    if (!id) return;
    if (addType === 'brush') {
      if (!brushForm.usage || !brushForm.value) return;
      await addBrushNorm(id, {
        name: brushForm.usage,
        value: brushForm.value,
        unit: brushForm.unit,
        brushName: brushForm.name,
        opacity: brushForm.opacity
      });
    } else {
      if (!typoForm.fontFamily) return;
      await addTypographyNorm(id, {
        fontFamily: typoForm.fontFamily,
        fontWeight: typoForm.fontWeight,
        fontUsage: typoForm.fontUsage,
        fontStyle: typoForm.fontStyle
      });
    }
    setIsAddingNorm(false);
    resetForm();
  };

  return (
    <>
      <PageHeader
        title="Normes Graphiques"
        subtitle="Ensemble des règles techniques qui garantissent la cohérence visuelle."
        subtitleClassName="max-w-xl"
      />

      {activeProject && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AddTile
              onClick={() => { resetForm(); setAddType('brush'); setIsAddingNorm(true); }}
              className="min-h-[260px]"
            />
            {/* Normes de trait */}
            {activeProject.brushNorms && activeProject.brushNorms.map((norm) => (
              <Card key={norm.id} clickable className="p-6 relative group">
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
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl font-light text-primary mr-1">{norm.value}</span>
                  <span className="text-lg text-blue font-medium">{norm.unit}</span>
                </div>
                <div className="mb-6 text-xs text-slate-500">
                  Opacité : {typeof norm.opacity === 'number' ? norm.opacity : (norm.opacity ?? '—')}
                </div>
                <div className="h-16 bg-blue/10 rounded-xl flex items-center justify-center border border-primary relative overflow-hidden group-hover:border-blue transition-colors">
                  <div className="flex flex-col items-center justify-center w-full px-4">
                    <div className="w-16 rounded-full mb-1 bg-primary" style={{ height: `${norm.value}px`, minHeight: '1px', backgroundColor: 'var(--color-primary)' }}></div>
                    <span className="text-[10px] text-blue font-bold uppercase tracking-wider">{norm.brushName || 'Pinceau'}</span>
                  </div>
                </div>
              </Card>
            ))}
            {/* Normes typographiques */}
            {activeProject.typographyNorms && activeProject.typographyNorms.map((norm) => (
              <Card key={norm.id} clickable className="p-6 relative group">
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
              </Card>
            ))}
          </div>

          <FormModal
            isOpen={!!editingNorm}
            onClose={() => setEditingNorm(null)}
            title="Modifier la norme"
          >
            <div className="space-y-4">
              {editingType === 'brush' ? (
                <>
                  <FormField label="Usage du pinceau">
                    <input type="text" value={brushForm.usage} onChange={e => setBrushField('usage', e.target.value)} placeholder="ex: Contour cheveux" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Nom du pinceau">
                    <input type="text" value={brushForm.name} onChange={e => setBrushField('name', e.target.value)} placeholder="ex: Plume G" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Taille (px)">
                    <input type="text" value={brushForm.value} onChange={e => setBrushField('value', e.target.value)} placeholder="ex: 8" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Unité">
                    <input type="text" value={brushForm.unit} onChange={e => setBrushField('unit', e.target.value)} placeholder="px" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Opacité (0 à 1)">
                    <input type="number" step="0.01" min={0} max={1} value={brushForm.opacity} onChange={e => setBrushField('opacity', e.target.value)} placeholder="ex: 1.0" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label="Famille de police">
                    <input type="text" value={typoForm.fontFamily} onChange={e => setTypoField('fontFamily', e.target.value)} placeholder="ex: Figtree" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Poids">
                    <input type="text" value={typoForm.fontWeight} onChange={e => setTypoField('fontWeight', e.target.value)} placeholder="ex: 700" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Usage">
                    <input type="text" value={typoForm.fontUsage} onChange={e => setTypoField('fontUsage', e.target.value)} placeholder="ex: Titre" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                  <FormField label="Style">
                    <input type="text" value={typoForm.fontStyle} onChange={e => setTypoField('fontStyle', e.target.value)} placeholder="ex: Italique" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
                  </FormField>
                </>
              )}
            </div>
            <ModalActions
              secondaryLabel="Annuler"
              primaryLabel="Modifier"
              onSecondary={() => setEditingNorm(null)}
              onPrimary={handleEditNorm}
              primaryDisabled={editingType === 'brush' ? !brushForm.usage || !brushForm.value : !typoForm.fontFamily}
            />
          </FormModal>
        </>
      )}

      <FormModal
        isOpen={isAddingNorm}
        onClose={() => setIsAddingNorm(false)}
        title="Nouvelle norme"
      >
        <div className="space-y-4">
          <FormField label="Type">
            <select value={addType} onChange={e => setAddType(e.target.value)} className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary appearance-none font-medium">
              <option value="brush">Trait</option>
              <option value="typography">Typographie</option>
            </select>
          </FormField>
          {addType === 'brush' ? (
            <>
              <FormField label="Usage du pinceau">
                <input type="text" value={brushForm.usage} onChange={e => setBrushField('usage', e.target.value)} placeholder="ex: Contour cheveux" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Nom du pinceau">
                <input type="text" value={brushForm.name} onChange={e => setBrushField('name', e.target.value)} placeholder="ex: Plume G" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Taille (px)">
                <input type="text" value={brushForm.value} onChange={e => setBrushField('value', e.target.value)} placeholder="ex: 8" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Unité">
                <input type="text" value={brushForm.unit} onChange={e => setBrushField('unit', e.target.value)} placeholder="px" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Opacité (0 à 1)">
                <input type="number" step="0.01" min={0} max={1} value={brushForm.opacity} onChange={e => setBrushField('opacity', e.target.value)} placeholder="ex: 1.0" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Famille de police">
                <input type="text" value={typoForm.fontFamily} onChange={e => setTypoField('fontFamily', e.target.value)} placeholder="ex: Figtree" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Poids">
                <input type="text" value={typoForm.fontWeight} onChange={e => setTypoField('fontWeight', e.target.value)} placeholder="ex: 700" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Usage">
                <input type="text" value={typoForm.fontUsage} onChange={e => setTypoField('fontUsage', e.target.value)} placeholder="ex: Titre" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
              <FormField label="Style">
                <input type="text" value={typoForm.fontStyle} onChange={e => setTypoField('fontStyle', e.target.value)} placeholder="ex: Italique" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" />
              </FormField>
            </>
          )}
        </div>
        <ModalActions
          secondaryLabel="Annuler"
          primaryLabel="Ajouter"
          onSecondary={() => setIsAddingNorm(false)}
          onPrimary={handleAddNorm}
          primaryDisabled={addType === 'brush' ? !brushForm.usage || !brushForm.value : !typoForm.fontFamily}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteNorm}
        title="Supprimer la norme"
        message="Êtes-vous sûr de vouloir supprimer cette norme ? Cette action est irréversible."
        confirmLabel="Supprimer"
        confirmClassName="bg-pink text-white hover:bg-pink/10"
        onCancel={() => setConfirmDeleteNorm(null)}
        onConfirm={async () => {
          if (!confirmDeleteNorm) return;
          setLoadingDelete(confirmDeleteNorm.id);
          if (confirmDeleteNorm.type === 'brush') {
            await deleteBrushNorm(id, confirmDeleteNorm.id);
          } else {
            await deleteTypographyNorm(id, confirmDeleteNorm.id);
          }
          setLoadingDelete(null);
          setConfirmDeleteNorm(null);
        }}
      />
    </>
  );
}