import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Dashboard from '../../src/pages/Dashboard';

const { mockNavigate, projectState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  projectState: {},
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe', avatarInitials: 'JD' } }),
}));

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('Dashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(projectState, {
      projects: [],
      trashedProjects: [],
      setActiveProjectId: vi.fn(),
      addProject: vi.fn().mockResolvedValue({ success: true }),
      duplicateProject: vi.fn(),
      deleteProject: vi.fn(),
      updateProjectName: vi.fn(),
      fetchTrashedProjects: vi.fn(),
      restoreProject: vi.fn(),
      deleteProjectPermanently: vi.fn(),
      fetchProjects: vi.fn(),
      pinProject: vi.fn().mockResolvedValue(true),
      unpinProject: vi.fn().mockResolvedValue(true),
      reorderPinnedProjects: vi.fn().mockResolvedValue(true),
    });
  });

  it('shows the first name of the signed-in person', () => {
    renderPage();
    expect(screen.getByText(/Hi, Jane\./i)).toBeInTheDocument();
  });

  it('creates a project via the modal', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '+ Create project' }));
    const input = await screen.findByPlaceholderText(/neo-tokyo/i);
    await user.type(input, 'Mon Projet');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(projectState.addProject).toHaveBeenCalledWith('Mon Projet'));
  });

  it('warns about a duplicate project name without blocking the creation', async () => {
    const user = userEvent.setup();
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    renderPage();

    await user.click(screen.getByRole('button', { name: '+ Create project' }));
    const input = await screen.findByPlaceholderText(/neo-tokyo/i);
    await user.type(input, 'neo-tokyo '); // case/space-insensitive match

    expect(await screen.findByText(/already have a project called/i)).toBeInTheDocument();

    // The warning is informative only — creating the duplicate still works.
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(projectState.addProject).toHaveBeenCalledWith('neo-tokyo '));
  });

  it('does not warn when renaming a project to its own name', async () => {
    const user = userEvent.setup();
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    await screen.findByDisplayValue('Neo-Tokyo');

    expect(screen.queryByText(/already have a project called/i)).not.toBeInTheDocument();
  });

  it('duplicates a project from its card', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    projectState.duplicateProject = vi.fn().mockResolvedValue({ id: 4, name: 'Neo-Tokyo (copy)' });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Duplicate project' }));

    await waitFor(() => expect(projectState.duplicateProject).toHaveBeenCalledWith(3));
  });

  it("disables every card's Duplicate button while one duplication is in flight", async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
      { id: 4, name: 'Retro Wave', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    // Never resolves within the test, so both buttons stay in the "busy" state
    // long enough to assert on it.
    let releaseDuplicate;
    projectState.duplicateProject = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseDuplicate = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();

    const [firstCardButton, secondCardButton] = screen.getAllByRole('button', {
      name: 'Duplicate project',
    });
    await user.click(firstCardButton);

    // Not just the clicked card: the OTHER card's button must also go disabled,
    // otherwise clicking it would silently no-op against the in-flight guard.
    await waitFor(() => expect(secondCardButton).toBeDisabled());
    expect(firstCardButton).toBeDisabled();

    releaseDuplicate({ id: 5, name: 'Neo-Tokyo (copy)' });
  });

  it('renames a project through the edit modal', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    projectState.updateProjectName = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    const input = await screen.findByLabelText('Project name');
    await user.clear(input);
    await user.type(input, 'Neo-Kyoto');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(projectState.updateProjectName).toHaveBeenCalledWith(3, { name: 'Neo-Kyoto' }),
    );
    // The modal closed on success.
    await waitFor(() => expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument());
  });

  it('refuses to save a blank project name', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    const input = await screen.findByLabelText('Project name');
    // An empty field disables Save outright; a whitespace-only name is the
    // sneaky case that must be caught by the trim() check instead.
    await user.clear(input);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Give your project a name.')).toBeInTheDocument();
    expect(projectState.updateProjectName).not.toHaveBeenCalled();
  });

  it('keeps the modal open and explains when the rename fails', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    projectState.updateProjectName = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    const input = await screen.findByLabelText('Project name');
    await user.clear(input);
    await user.type(input, 'Neo-Kyoto');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Something went wrong updating the project.'),
    ).toBeInTheDocument();
    // Still open, with the typed name preserved for a retry.
    expect(screen.getByLabelText('Project name')).toHaveValue('Neo-Kyoto');
  });

  it('opens a project when its title is clicked', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Neo-Tokyo' }));

    expect(mockNavigate).toHaveBeenCalledWith('/app/project/3/norms');
  });

  it('hides the trash section when the trash is empty', () => {
    renderPage();
    expect(screen.queryByText('Trash')).not.toBeInTheDocument();
  });

  it('restores a trashed project from the trash section', async () => {
    projectState.trashedProjects = [
      { id: 9, name: 'Old poster', deletedAt: '2026-07-10 10:00:00', daysLeft: 21 },
    ];
    projectState.restoreProject = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Old poster')).toBeInTheDocument();
    expect(screen.getByText(/21 days left/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(projectState.restoreProject).toHaveBeenCalledWith(9));
  });

  it('permanently deletes a trashed project after its own confirmation', async () => {
    projectState.trashedProjects = [
      { id: 9, name: 'Old poster', deletedAt: '2026-07-10 10:00:00', daysLeft: 3 },
    ];
    projectState.deleteProjectPermanently = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    // The dedicated dialog warns that this step is irreversible.
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument();
    const dialogButtons = screen.getAllByRole('button', { name: 'Delete forever' });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(projectState.deleteProjectPermanently).toHaveBeenCalledWith(9));
  });

  it('disables Restore and Delete forever on every trashed item while a restore is in flight', async () => {
    projectState.trashedProjects = [
      { id: 9, name: 'Old poster', deletedAt: '2026-07-10 10:00:00', daysLeft: 21 },
      { id: 10, name: 'Old flyer', deletedAt: '2026-07-11 10:00:00', daysLeft: 20 },
    ];
    // Never resolves within the test, so both rows stay in the "busy" state
    // long enough to assert on it.
    let releaseRestore;
    projectState.restoreProject = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseRestore = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();

    const [firstRestore, secondRestore] = screen.getAllByRole('button', { name: 'Restore' });
    const [firstDeleteForever, secondDeleteForever] = screen.getAllByRole('button', {
      name: 'Delete forever',
    });
    await user.click(firstRestore);

    // A restore in flight must block every trash action (both rows, both
    // buttons) so a concurrent "delete forever" can never race the row whose
    // deleted_at is about to flip back to NULL server-side.
    await waitFor(() => expect(secondRestore).toBeDisabled());
    expect(firstRestore).toBeDisabled();
    expect(firstDeleteForever).toBeDisabled();
    expect(secondDeleteForever).toBeDisabled();

    releaseRestore(true);
  });

  it('pins a project from its card', async () => {
    projectState.projects = [
      {
        id: 3,
        name: 'Neo-Tokyo',
        lastEdited: 'Just now',
        normsCount: 0,
        palette: [],
        pinned: false,
      },
    ];
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Pin project' }));

    await waitFor(() => expect(projectState.pinProject).toHaveBeenCalledWith(3));
  });

  it('unpins a project and shows it under a dedicated Pinned section', async () => {
    projectState.projects = [
      {
        id: 3,
        name: 'Neo-Tokyo',
        lastEdited: 'Just now',
        normsCount: 0,
        palette: [],
        pinned: true,
      },
      {
        id: 4,
        name: 'Retro Wave',
        lastEdited: 'Just now',
        normsCount: 0,
        palette: [],
        pinned: false,
      },
    ];
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Pinned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unpin project' }));

    await waitFor(() => expect(projectState.unpinProject).toHaveBeenCalledWith(3));
  });

  it('hides the Pinned section when no project is pinned', () => {
    projectState.projects = [
      {
        id: 3,
        name: 'Neo-Tokyo',
        lastEdited: 'Just now',
        normsCount: 0,
        palette: [],
        pinned: false,
      },
    ];
    renderPage();
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
  });

  it('hides the search bar under the 6-project threshold', () => {
    projectState.projects = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Project ${i + 1}`,
      lastEdited: 'Just now',
      normsCount: 0,
      palette: [],
      pinned: false,
    }));
    renderPage();
    expect(screen.queryByPlaceholderText(/search projects/i)).not.toBeInTheDocument();
  });

  it('shows the search bar and debounces the query once there are 6+ projects', async () => {
    vi.useFakeTimers();
    projectState.projects = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Project ${i + 1}`,
      lastEdited: 'Just now',
      normsCount: 0,
      palette: [],
      pinned: false,
    }));
    renderPage();

    const input = screen.getByPlaceholderText(/search projects/i);
    fireEvent.change(input, { target: { value: 'Neo' } });

    expect(projectState.fetchProjects).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(projectState.fetchProjects).toHaveBeenCalledWith({ search: 'Neo' });

    vi.useRealTimers();
  });
});
