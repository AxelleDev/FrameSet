/**
 * Dashboard page (route: /app/dashboard).
 *
 * The landing screen after login: shows a greeting, project/norm totals, and a
 * grid of project cards. From here the user can create, rename, delete and open
 * projects. Opening a project navigates into its norms section.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import FormModal from '../components/FormModal';
import FormField from '../components/FormField';
import TextInput from '../components/TextInput';
import ModalActions from '../components/ModalActions';
import ActionIconButton from '../components/ActionIconButton';
import ConfirmDialog from '../components/ConfirmDialog';
import AddTile from '../components/AddTile';
import Card from '../components/Card';
import Button from '../components/Button';

/**
 * Formats a project's `lastEdited` value for display after the "Edited " prefix.
 * The API returns either the just-edited sentinel ("Just now") or a
 * "DD/MM HH:MM" string; we render "just now" or "on DD/MM at HH:MM".
 */
function formatModified(value) {
  if (!value) return '';
  const match = /^(\d{2}\/\d{2})\s+(\d{2}:\d{2})$/.exec(value);
  return match ? `on ${match[1]} at ${match[2]}` : 'just now';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { projects, setActiveProjectId, addProject, deleteProject, updateProjectName } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
  const [editProjectError, setEditProjectError] = useState("");

  // Clear any active project when landing on the dashboard (we are not in a project).
  useEffect(() => {
    setActiveProjectId(null);
  }, [setActiveProjectId]);

  // Aggregate norm count across all projects for the summary stat.
  const totalNorms = projects.reduce((acc, p) => acc + p.normsCount, 0);

  // Create a project from the modal, ignoring blank names, then reset the form.
  const handleCreateProject = async () => {
    if (newProjectName && newProjectName.trim().length > 0) {
      await addProject(newProjectName);
      setIsCreatingProject(false);
      setNewProjectName('');
      showToast('Project created.');
    }
  };

  // Open the rename modal; stopPropagation prevents the card's open-project click.
  const openEditProject = (e, project) => {
    e.stopPropagation();
    setEditProjectId(project.id);
    setEditProjectName(project.name || '');
    setIsEditingProject(true);
  };

  const handleEditProject = async () => {
    setEditProjectError("");
    if (!editProjectId || !editProjectName || !editProjectName.trim()) {
      setEditProjectError("Give your project a name.");
      return;
    }
    try {
      await updateProjectName(editProjectId, { name: editProjectName.trim() });
      setIsEditingProject(false);
      setEditProjectId(null);
      setEditProjectName("");
      showToast('Project updated.');
    } catch (e) {
      setEditProjectError(e?.message || "Something went wrong updating the project.");
    }
  };

  // Navigate into a project (defaults to its norms section).
  const openProject = (id) => {
    navigate(`/app/project/${id}/norms`);
  };

  // Stage a project for deletion (confirmation handled by ConfirmDialog).
  const handleDeleteProject = (e, id) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    setConfirmDeleteProject(project ? { id: project.id, name: project.name } : { id, name: '' });
  };

  return (
    <>
      <Card className="overflow-hidden mb-12 animate-fade-in">
        <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-start justify-between">
          <div>
            <h1 className="text-primary text-3xl md:text-4xl font-light mb-4 tracking-tight">Hi, {user.name.split(' ')[0]}.</h1>
            <p className="text-primary max-w-lg leading-relaxed font-medium">
              You currently have <strong className="text-blue">{projects.length} project{projects.length === 1 ? '' : 's'}</strong>.
            </p>
            <div className="mt-8 flex space-x-4">
               <Button onClick={() => setIsCreatingProject(true)} variant="primary" className="px-6 py-3">
                 + Create project
               </Button>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-6 mt-6 md:mt-0">
             <div className="p-4 rounded-2xl w-32 text-center stat-bg">
                <div className="text-2xl font-bold text-primary">{totalNorms}</div>
                   <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">{totalNorms === 1 ? 'Standard' : 'Standards'}</div>
             </div>
             <div className="p-4 rounded-2xl w-32 text-center stat-bg">
               <div className="text-2xl font-bold text-primary">{projects.length}</div>
               <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">{projects.length === 1 ? 'Project' : 'Projects'}</div>
             </div>
          </div>
        </div>
      </Card>

      {projects.length === 0 ? (
        <div className="text-center mb-6">
          <h2 className="text-lg font-medium text-primary mb-1">Create your first project</h2>
          <p className="text-sm text-primary/60 max-w-md mx-auto">Each project keeps its graphic standards and color palette in one place.</p>
        </div>
      ) : (
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-medium text-primary">{projects.length === 1 ? 'Active project' : 'Active projects'}</h2>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project.id} clickable onClick={() => openProject(project.id)} className="group p-6 overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2 z-30">
              <ActionIconButton
                onClick={(e) => openEditProject(e, project)}
                title="Edit project"
                intent="edit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z" />
                </svg>
              </ActionIconButton>
              <ActionIconButton
                onClick={(e) => handleDeleteProject(e, project.id)}
                title="Delete project"
                intent="delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </ActionIconButton>
            </div>
            <div className="relative z-10 flex flex-col h-full min-h-[160px]">
              <h3 className="text-xl font-semibold text-primary mt-2 mb-1 group-hover:text-blue transition-colors pr-8">{project.name}</h3>
              <p className="text-sm text-primary mb-auto">Edited {formatModified(project.lastEdited)}</p>
              <div className="mt-8 pt-4 flex -space-x-2 min-h-[40px] items-center">
                {project.palette.map((color, i) => (
                  <div key={color.id ?? `${color.hex}-${i}`} className="w-6 h-6 rounded-full ring-2 ring-white"
                       style={{ backgroundColor: color.hex }}
                       title={color.name}></div>
                ))}
                {project.palette.length === 0 && (
                  <div className="text-xs text-blue italic flex items-center">
                    <div className="w-6 h-6 rounded-full bg-blue/10 ring-2 ring-white mr-1"></div>
                    <div className="w-6 h-6 rounded-full bg-blue/5 ring-2 ring-white"></div>
                  </div>
                )}
              </div>

            </div>
          </Card>
        ))}
        <AddTile
          onClick={() => setIsCreatingProject(true)}
          label="New project"
          labelClassName="text-sm font-medium text-primary"
          className="p-6 min-h-[200px]"
        />
      </div>

      <FormModal
        isOpen={isCreatingProject}
        onClose={() => setIsCreatingProject(false)}
        title="New project"
      >
        <div className="space-y-4">
          <FormField label="Project name">
            {/* autoFocus is intentional: focus the field when the modal opens. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <TextInput type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="Neo-Tokyo Editorial" autoFocus />
          </FormField>
        </div>

        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Create project"
          onSecondary={() => setIsCreatingProject(false)}
          onPrimary={handleCreateProject}
          primaryDisabled={!newProjectName}
        />
      </FormModal>

      <FormModal
        isOpen={isEditingProject}
        onClose={() => { setIsEditingProject(false); setEditProjectId(null); setEditProjectError(""); }}
        title="Edit project"
      >
        <div className="space-y-4">
          <FormField label="Project name">
            {/* autoFocus is intentional: focus the field when the modal opens. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <TextInput type="text" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEditProject()} placeholder="Neo-Tokyo Editorial" autoFocus />
          </FormField>
          {editProjectError && (
            <div className="text-danger text-sm font-medium mt-2">{editProjectError}</div>
          )}
        </div>

        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Edit"
          onSecondary={() => { setIsEditingProject(false); setEditProjectId(null); setEditProjectError(""); }}
          onPrimary={handleEditProject}
          primaryDisabled={!editProjectName}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteProject}
        title="Delete project?"
        message={
          confirmDeleteProject?.name
            ? `All graphic standards and colors in "${confirmDeleteProject.name}" will be permanently lost.`
            : 'All its graphic standards and colors will be permanently lost.'
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteProject(null)}
        onConfirm={async () => {
          if (!confirmDeleteProject?.id) return;
          await deleteProject(confirmDeleteProject.id);
          setConfirmDeleteProject(null);
          showToast('Project deleted.');
        }}
      />
    </>
  );
}