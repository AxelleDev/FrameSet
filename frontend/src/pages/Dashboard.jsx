import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import useProjectApi from '../hooks/useProject';
import { useNavigate } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Dashboard() {
  const { user, projects, setActiveProjectId, setGlobalError } = useData();
  const { addProject, deleteProject, updateProject } = useProjectApi();
  const navigate = useNavigate();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
  const [editProjectError, setEditProjectError] = useState("");

  useEffect(() => {
    setActiveProjectId(null);
  }, [setActiveProjectId]);

  const totalNorms = projects.reduce((acc, p) => acc + p.normsCount, 0);

  const handleCreateProject = async () => {
    if (newProjectName && newProjectName.trim().length > 0) {
      await addProject(newProjectName, { onGlobalError: setGlobalError });
      setIsCreatingProject(false);
      setNewProjectName('');
    }
  };

  const openEditProject = (e, project) => {
    e.stopPropagation();
    setEditProjectId(project.id);
    setEditProjectName(project.name || '');
    setIsEditingProject(true);
  };

  const handleEditProject = async () => {
    setEditProjectError("");
    if (!editProjectId || !editProjectName || !editProjectName.trim()) {
      setEditProjectError("Le nom du projet ne peut pas être vide.");
      return;
    }
    try {
      await updateProject(editProjectId, { name: editProjectName.trim() }, { onGlobalError: setGlobalError });
      setIsEditingProject(false);
      setEditProjectId(null);
      setEditProjectName("");
    } catch (e) {
      setEditProjectError(e?.message || "Erreur lors de la modification du projet.");
    }
  };

  const openProject = (id) => {
    navigate(`/app/project/${id}/norms`);
  };

  const handleDeleteProject = (e, id) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    setConfirmDeleteProject(project ? { id: project.id, name: project.name } : { id, name: '' });
  };

  return (
    <>
      <Card className="overflow-hidden mb-12 animate-fade-in border border-white">
        <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-start justify-between">
          <div>
            <h2 className="text-primary text-3xl md:text-4xl font-light mb-4 tracking-tight">Bonjour, {user.name.split(' ')[0]}.</h2>
            <p className="text-primary max-w-lg leading-relaxed font-medium">
              Vous avez actuellement <strong className="text-blue">{projects.length} projet{projects.length === 1 ? '' : 's'} actif{projects.length === 1 ? '' : 's'}</strong>.
            </p>
            <div className="mt-8 flex space-x-4">
               <Button onClick={() => setIsCreatingProject(true)} variant="primary" className="px-6 py-3">
                 + Créer un projet
               </Button>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-6 mt-6 md:mt-0">
             <div className="p-4 rounded-2xl w-32 text-center stat-bg">
                <div className="text-2xl font-bold text-primary">{totalNorms}</div>
                   <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">{totalNorms === 1 ? 'Norme' : 'Normes'}</div>
             </div>
             <div className="p-4 rounded-2xl w-32 text-center stat-bg">
               <div className="text-2xl font-bold text-primary">{projects.length}</div>
               <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">{projects.length === 1 ? 'Projet' : 'Projets'}</div>
             </div>
          </div>
        </div>
      </Card>

      <div className="flex items-end justify-between mb-6">
        <h3 className="text-xl font-medium text-primary">{projects.length === 1 ? 'Projet Actif' : 'Projets Actifs'}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project.id} clickable onClick={() => openProject(project.id)} className="group p-6 overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-lavender-100 to-transparent rounded-bl-full -mr-14 -mt-14 transition-transform group-hover:scale-110"></div>

            <div className="absolute top-4 right-4 flex gap-2 z-30">
              <ActionIconButton
                onClick={(e) => openEditProject(e, project)}
                title="Modifier le projet"
                intent="edit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                </svg>
              </ActionIconButton>
              <ActionIconButton
                onClick={(e) => handleDeleteProject(e, project.id)}
                title="Supprimer le projet"
                intent="delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </ActionIconButton>
            </div>
            <div className="relative z-10 flex flex-col h-full min-h-[160px]">
              <h3 className="text-xl font-semibold text-primary mt-2 mb-1 group-hover:text-blue transition-colors pr-8">{project.name}</h3>
              <p className="text-sm text-primary mb-auto">Modifié {project.lastEdited}</p>
              <div className="mt-8 pt-4 border-t border-blue flex -space-x-2 min-h-[40px] items-center">
                {project.palette.map((color) => (
                  <div key={color.hex} className="w-6 h-6 rounded-full border border-white shadow-sm ring-1 ring-black/5" 
                       style={{ backgroundColor: color.hex }} 
                       title={color.name}></div>
                ))}
                {project.palette.length === 0 && (
                  <div className="text-xs text-blue italic flex items-center">
                    <div className="w-6 h-6 rounded-full bg-blue/10 border border-white mr-1"></div>
                    <div className="w-6 h-6 rounded-full bg-blue/5 border border-white"></div>
                  </div>
                )}
              </div>

            </div>
          </Card>
        ))}
        <AddTile
          onClick={() => setIsCreatingProject(true)}
          label="Nouveau Projet"
          labelClassName="text-sm font-medium text-primary"
          className="p-6 min-h-[200px]"
        />
      </div>

      <FormModal
        isOpen={isCreatingProject}
        onClose={() => setIsCreatingProject(false)}
        title="Nouveau Projet"
      >
        <div className="space-y-4">
          <FormField label="Nom du projet">
            <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="ex: Neo-Tokyo Editorial" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" autoFocus />
          </FormField>
        </div>

        <ModalActions
          secondaryLabel="Annuler"
          primaryLabel="Créer"
          onSecondary={() => setIsCreatingProject(false)}
          onPrimary={handleCreateProject}
          primaryDisabled={!newProjectName}
        />
      </FormModal>

      <FormModal
        isOpen={isEditingProject}
        onClose={() => { setIsEditingProject(false); setEditProjectId(null); setEditProjectError(""); }}
        title="Modifier le projet"
      >
        <div className="space-y-4">
          <FormField label="Nom du projet">
            <input type="text" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEditProject()} placeholder="ex: Neo-Tokyo Editorial" className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary" autoFocus />
          </FormField>
          {editProjectError && (
            <div className="text-pink text-sm font-medium mt-2">{editProjectError}</div>
          )}
        </div>

        <ModalActions
          secondaryLabel="Annuler"
          primaryLabel="Modifier"
          onSecondary={() => { setIsEditingProject(false); setEditProjectId(null); setEditProjectError(""); }}
          onPrimary={handleEditProject}
          primaryDisabled={!editProjectName}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteProject}
        title="Supprimer le projet"
        message={
          confirmDeleteProject?.name
            ? `Êtes-vous sûr de vouloir supprimer « ${confirmDeleteProject.name} » ? Cette action est irréversible.`
            : 'Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.'
        }
        confirmLabel="Supprimer"
        confirmClassName="bg-pink text-white hover:bg-pink/10"
        onCancel={() => setConfirmDeleteProject(null)}
        onConfirm={async () => {
          if (!confirmDeleteProject?.id) return;
          await deleteProject(confirmDeleteProject.id);
          setConfirmDeleteProject(null);
        }}
      />
    </>
  );
}