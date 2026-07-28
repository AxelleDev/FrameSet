// Dashboard page (route: /app/dashboard): post-login landing with project totals
// and a grid of cards to create, rename, delete and open projects.
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import Alert from '../components/Alert';
import Seo from '../components/Seo';
import TrashSection from '../components/TrashSection';
import TrashRow from '../components/TrashRow';
import EmptyState from '../components/EmptyState';
import { EditIcon, DuplicateIcon, DeleteIcon, PinIcon } from '../components/icons';
import { formatModified } from '../utils/date';
import useDragReorder from '../hooks/useDragReorder';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

// The search bar only earns its place once there's enough to actually filter.
const SEARCH_VISIBILITY_THRESHOLD = 6;
const SEARCH_DEBOUNCE_MS = 300;

export default function Dashboard() {
  const { user } = useAuth();
  const {
    projects,
    projectsPagination,
    projectsTotalAll,
    projectsLoading,
    trashedProjects,
    loadMoreProjects,
    setActiveProjectId,
    addProject,
    duplicateProject,
    deleteProject,
    updateProjectName,
    fetchTrashedProjects,
    restoreProject,
    deleteProjectPermanently,
    fetchProjects,
    pinProject,
    unpinProject,
    reorderPinnedProjects,
  } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(null);
  const [editProjectError, setEditProjectError] = useState('');

  const editingOriginalName = projects.find((p) => p.id === editProjectId)?.name ?? '';
  useUnsavedChangesWarning(
    (isCreatingProject && newProjectName.trim() !== '') ||
      (isEditingProject && editProjectName.trim() !== editingOriginalName),
  );

  // Clear any active project when landing on the dashboard (we are not in a project).
  useEffect(() => {
    setActiveProjectId(null);
  }, [setActiveProjectId]);

  // Load the trash so its section can appear (it is hidden when empty).
  useEffect(() => {
    fetchTrashedProjects({ silent: true });
  }, [fetchTrashedProjects]);

  // Aggregate norm count across the loaded projects for the summary stat. Guard
  // each normsCount so a project missing the field can't turn the total into NaN.
  const totalNorms = projects.reduce((acc, p) => acc + (p.normsCount || 0), 0);
  // The hero/stat tiles and the empty/search gates use the UNFILTERED total
  // (projectsTotalAll): pagination.total follows the active search filter, so
  // using it there would make "You currently have N projects" change while
  // typing a search — and hide the search box on a zero-match filter, leaving
  // no way to clear it. The grid's own pagination stays on the filtered total.
  const paginationTotal = projectsPagination?.total ?? projects.length;
  const totalProjects = Math.max(projectsTotalAll || 0, paginationTotal, projects.length);
  const hasMoreProjects = projects.length < paginationTotal;

  // Pinned projects stay at the top, own their own drag-and-drop reorder
  // (same behavior as the palette's colors and the norms' standards).
  // Memoized on `projects` so the drag hook doesn't see a "new" array (and
  // reset any in-flight preview) on every unrelated re-render.
  const pinnedProjects = useMemo(() => projects.filter((p) => p.pinned), [projects]);
  const unpinnedProjects = useMemo(() => projects.filter((p) => !p.pinned), [projects]);
  const pinnedDrag = useDragReorder({
    items: pinnedProjects,
    getId: (project) => project.id,
    onPersist: (next) => reorderPinnedProjects(next.map((project) => project.id)),
  });

  // Toggling is disabled mid-flight so a fast double-click can't fire pin then
  // unpin (or vice versa) before the first request settles.
  const [pinningId, setPinningId] = useState(null);
  const handlePinToggle = async (e, project) => {
    e.stopPropagation();
    if (pinningId) return;
    setPinningId(project.id);
    try {
      const ok = project.pinned ? await unpinProject(project.id) : await pinProject(project.id);
      if (ok) showToast(project.pinned ? 'Project unpinned.' : 'Project pinned.');
    } finally {
      setPinningId(null);
    }
  };

  // Search/filter by project name, shown once there's enough projects to
  // justify it. Debounced so typing doesn't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef(null);
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchProjects({ search: value });
    }, SEARCH_DEBOUNCE_MS);
  };
  const showSearch = totalProjects >= SEARCH_VISIBILITY_THRESHOLD || searchInput !== '';

  // Create a project from the modal, ignoring blank names, then reset the form.
  // submitting guards against a double submit (Enter key + button click).
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const handleCreateProject = async () => {
    if (isSubmittingProject) return;
    if (!newProjectName || newProjectName.trim().length === 0) return;
    setIsSubmittingProject(true);
    try {
      const created = await addProject(newProjectName);
      // Only confirm and close the modal when the project was actually created.
      if (!created) return;
      setIsCreatingProject(false);
      setNewProjectName('');
      showToast('Project created.');
    } finally {
      setIsSubmittingProject(false);
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
    setEditProjectError('');
    if (isSubmittingProject) return;
    if (!editProjectId || !editProjectName || !editProjectName.trim()) {
      setEditProjectError('Give your project a name.');
      return;
    }
    setIsSubmittingProject(true);
    try {
      // updateProjectName never throws; it returns false on failure (the global
      // error banner already surfaced the reason).
      const ok = await updateProjectName(editProjectId, { name: editProjectName.trim() });
      if (!ok) {
        setEditProjectError('Something went wrong updating the project.');
        return;
      }
      setIsEditingProject(false);
      setEditProjectId(null);
      setEditProjectName('');
      showToast('Project updated.');
    } finally {
      setIsSubmittingProject(false);
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

  // Trash actions: restore puts the project back in the grid; permanent delete
  // is staged behind its own confirmation dialog. The two are mutually
  // exclusive (trashBusy) so a restore in flight and a "delete forever" can
  // never race on the same soft-deleted row (which would otherwise surface a
  // confusing 404 when the loser's request lands after the row's state changed).
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const trashBusy = restoringId !== null || confirmPermanentDelete !== null;
  const handleRestoreProject = async (id) => {
    if (trashBusy) return;
    setRestoringId(id);
    try {
      const ok = await restoreProject(id);
      if (ok) showToast('Project restored.');
    } finally {
      setRestoringId(null);
    }
  };

  // Duplicate a project (norms + palette) as "<name> (copy)". duplicatingId
  // disables that card's button while the copy is in flight.
  const [duplicatingId, setDuplicatingId] = useState(null);
  const handleDuplicateProject = async (e, id) => {
    e.stopPropagation();
    if (duplicatingId) return;
    setDuplicatingId(id);
    try {
      const copy = await duplicateProject(id);
      // duplicateProject never throws; null means the global banner has the reason.
      if (copy) showToast(`Project duplicated as "${copy.name}".`);
    } finally {
      setDuplicatingId(null);
    }
  };

  // The 4 action buttons, shared between the mobile header row and the
  // desktop hover overlay below (renderProjectCard) so they're only wired up
  // once.
  const renderProjectActions = (project) => (
    <>
      <ActionIconButton
        onClick={(e) => handlePinToggle(e, project)}
        title={project.pinned ? 'Unpin project' : 'Pin project'}
        intent="edit"
        disabled={pinningId !== null}
      >
        <PinIcon filled={project.pinned} />
      </ActionIconButton>
      <ActionIconButton
        onClick={(e) => openEditProject(e, project)}
        title="Edit project"
        intent="edit"
      >
        <EditIcon />
      </ActionIconButton>
      <ActionIconButton
        onClick={(e) => handleDuplicateProject(e, project.id)}
        title="Duplicate project"
        intent="edit"
        disabled={duplicatingId !== null}
      >
        <DuplicateIcon />
      </ActionIconButton>
      <ActionIconButton
        onClick={(e) => handleDeleteProject(e, project.id)}
        title="Delete project"
        intent="delete"
      >
        <DeleteIcon />
      </ActionIconButton>
    </>
  );

  // Shared card body for both the pinned and regular sections. moveButtons is
  // only passed for the pinned section (its keyboard-operable drag-alternative).
  const renderProjectCard = (project, moveButtons) => (
    <Card key={project.id} clickable className="group p-6 overflow-hidden">
      {/* Mobile: a dedicated header row instead of the hover overlay below —
          there's no hover on touch, so that overlay would otherwise sit
          permanently on top of the title (see ActionIconButton's hover:none
          handling). sm: switches the same buttons back to the original
          hover-revealed absolute overlay — one set of buttons, repositioned
          by breakpoint, not a duplicated one (a second copy would confuse
          both assistive tech and any test querying by accessible name). */}
      <div className="flex justify-end gap-2 mb-3 relative z-10 sm:mb-0 sm:absolute sm:top-4 sm:right-4 sm:z-30">
        {renderProjectActions(project)}
      </div>
      <div className="relative z-10 flex flex-col h-full min-h-[160px]">
        {/* Stretched-link: the title is the only "open project" control, and its
            ::after overlay makes the whole card body clickable — without making the
            container itself a button (which would nest the edit/delete buttons and
            break ARIA). The action buttons sit above the overlay (z-30). pr-8 only
            applies from sm: on mobile the actions are their own row above, not an
            overlay, so the title doesn't need to make room for them. */}
        <h3 className="text-xl font-semibold text-primary mt-2 mb-1 group-hover:text-blue transition-colors sm:pr-8">
          <button
            type="button"
            onClick={() => openProject(project.id)}
            className="text-left rounded focus-ring after:absolute after:inset-0 after:content-['']"
          >
            {project.name}
          </button>
        </h3>
        <p className="text-sm text-primary mb-auto">Edited {formatModified(project.lastEdited)}</p>
        <div className="mt-8 pt-4 flex -space-x-2 min-h-[40px] items-center">
          {project.palette.map((color, i) => (
            <div
              key={color.id ?? `${color.hex}-${i}`}
              className="w-6 h-6 rounded-full ring-2 ring-surface"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            ></div>
          ))}
          {project.palette.length === 0 && (
            <div className="text-xs text-blue italic flex items-center">
              <div className="w-6 h-6 rounded-full bg-blue/10 ring-2 ring-surface mr-1"></div>
              <div className="w-6 h-6 rounded-full bg-blue/5 ring-2 ring-surface"></div>
            </div>
          )}
        </div>
      </div>
      {moveButtons}
    </Card>
  );

  return (
    <>
      <Seo title="Dashboard" noindex />
      <Card className="overflow-hidden mb-12 animate-fade-in">
        {/* Side-by-side only from lg: the sidebar appears at md and eats ~320px
            of the viewport, so a 768-1023px window leaves this hero too narrow
            for a row (the greeting wraps hard and the stat tiles get clipped). */}
        <div className="relative z-10 p-6 sm:p-10 lg:p-14 flex flex-col lg:flex-row items-start justify-between gap-6 lg:gap-8">
          <div>
            <h1 className="text-primary text-3xl md:text-4xl font-light mb-4 tracking-tight">
              Hi, {user.name.split(' ')[0]}.
            </h1>
            <p className="text-primary max-w-lg leading-relaxed font-medium">
              You currently have{' '}
              <strong className="text-blue">
                {totalProjects} project{totalProjects === 1 ? '' : 's'}
              </strong>
              .
            </p>
            <div className="mt-8 flex space-x-4">
              <Button
                onClick={() => setIsCreatingProject(true)}
                variant="primary"
                className="px-6 py-3"
              >
                + Create project
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 shrink-0 lg:mt-0">
            <div className="p-4 rounded-2xl flex-1 sm:flex-none sm:w-32 text-center stat-bg">
              <div className="text-2xl font-bold text-primary">{totalNorms}</div>
              <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">
                {totalNorms === 1 ? 'Standard' : 'Standards'}
              </div>
            </div>
            <div className="p-4 rounded-2xl flex-1 sm:flex-none sm:w-32 text-center stat-bg">
              <div className="text-2xl font-bold text-primary">{totalProjects}</div>
              <div className="text-xs text-primary uppercase tracking-wider mt-1 font-semibold">
                {totalProjects === 1 ? 'Project' : 'Projects'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {totalProjects === 0 ? (
        <EmptyState
          className="mb-6"
          title="Create your first project"
          description="Each project keeps its graphic standards and color palette in one place."
        />
      ) : (
        showSearch && (
          <div className="mb-6 max-w-xs">
            <TextInput
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search projects…"
              aria-label="Search projects by name"
            />
          </div>
        )
      )}

      {pinnedDrag.previewItems.length > 0 && (
        <>
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-xl font-medium text-primary">Pinned</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {pinnedDrag.previewItems.map((project, idx) => (
              <div
                key={project.id}
                ref={pinnedDrag.registerItemRef(project.id)}
                className={pinnedDrag.isDragging(project.id) ? 'opacity-30 z-40' : ''}
                {...pinnedDrag.getDragHandlers(project, idx)}
              >
                {renderProjectCard(
                  project,
                  <div className="absolute bottom-3 inset-x-3 flex justify-between z-30">
                    <ActionIconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        pinnedDrag.moveItem(idx, idx - 1);
                      }}
                      title="Move project left"
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
                        pinnedDrag.moveItem(idx, idx + 1);
                      }}
                      title="Move project right"
                      variant="light"
                      srOnly
                      disabled={idx === pinnedDrag.previewItems.length - 1}
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
                  </div>,
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {totalProjects > 0 && (
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-medium text-primary">
            {pinnedDrag.previewItems.length > 0
              ? 'Your projects'
              : totalProjects === 1
                ? 'Your project'
                : 'Your projects'}
          </h2>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {unpinnedProjects.map((project) => renderProjectCard(project))}
        <AddTile
          onClick={() => setIsCreatingProject(true)}
          label="New project"
          labelClassName="text-sm font-medium text-primary"
          className="p-6 min-h-[200px]"
        />
      </div>

      {hasMoreProjects && (
        <div className="mt-8 flex justify-center">
          <Button variant="ghost" onClick={loadMoreProjects} loading={projectsLoading}>
            Load more projects
          </Button>
        </div>
      )}

      {trashedProjects.length > 0 && (
        <TrashSection
          id="trash-title"
          count={trashedProjects.length}
          note="Trashed projects are kept for 30 days, then deleted forever."
        >
          {trashedProjects.map((project) => (
            <TrashRow
              key={project.id}
              title={project.name}
              daysLeft={project.daysLeft}
              onRestore={() => handleRestoreProject(project.id)}
              restoring={restoringId === project.id}
              busy={trashBusy}
              onDeleteForever={() =>
                setConfirmPermanentDelete({ id: project.id, name: project.name })
              }
            />
          ))}
        </TrashSection>
      )}

      <FormModal
        isOpen={isCreatingProject}
        onClose={() => setIsCreatingProject(false)}
        title="New project"
      >
        <div className="space-y-4">
          <FormField label="Project name">
            {/* autoFocus is intentional: focus the field when the modal opens. */}
            <TextInput
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              placeholder="Neo-Tokyo Editorial"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
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
        onClose={() => {
          setIsEditingProject(false);
          setEditProjectId(null);
          setEditProjectError('');
        }}
        title="Edit project"
      >
        <div className="space-y-4">
          <FormField label="Project name">
            {/* autoFocus is intentional: focus the field when the modal opens. */}
            <TextInput
              type="text"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditProject()}
              placeholder="Neo-Tokyo Editorial"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </FormField>
          {editProjectError && (
            <Alert variant="danger" className="mt-2">
              {editProjectError}
            </Alert>
          )}
        </div>

        <ModalActions
          secondaryLabel="Cancel"
          primaryLabel="Save"
          onSecondary={() => {
            setIsEditingProject(false);
            setEditProjectId(null);
            setEditProjectError('');
          }}
          onPrimary={handleEditProject}
          primaryDisabled={!editProjectName}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!confirmDeleteProject}
        title="Move to trash?"
        message={
          confirmDeleteProject?.name
            ? `"${confirmDeleteProject.name}" will be moved to the trash. You can restore it for 30 days; after that it is deleted forever.`
            : 'The project will be moved to the trash. You can restore it for 30 days; after that it is deleted forever.'
        }
        confirmLabel="Move to trash"
        onCancel={() => setConfirmDeleteProject(null)}
        onConfirm={async () => {
          if (!confirmDeleteProject?.id) return;
          const ok = await deleteProject(confirmDeleteProject.id);
          setConfirmDeleteProject(null);
          if (ok) showToast('Project moved to trash.');
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmPermanentDelete}
        title="Delete forever?"
        message={
          confirmPermanentDelete?.name
            ? `"${confirmPermanentDelete.name}" and all its graphic standards and colors will be permanently lost. This cannot be undone.`
            : 'The project and all its graphic standards and colors will be permanently lost. This cannot be undone.'
        }
        confirmLabel="Delete forever"
        onCancel={() => setConfirmPermanentDelete(null)}
        onConfirm={async () => {
          if (!confirmPermanentDelete?.id) return;
          const ok = await deleteProjectPermanently(confirmPermanentDelete.id);
          setConfirmPermanentDelete(null);
          if (ok) showToast('Project permanently deleted.');
        }}
      />
    </>
  );
}
