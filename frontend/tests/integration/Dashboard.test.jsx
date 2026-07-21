import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    <HelmetProvider><MemoryRouter>
      <Dashboard />
    </MemoryRouter></HelmetProvider>
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

  it('duplicates a project from its card', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    projectState.duplicateProject = vi
      .fn()
      .mockResolvedValue({ id: 4, name: 'Neo-Tokyo (copy)' });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Duplicate project' }));

    await waitFor(() => expect(projectState.duplicateProject).toHaveBeenCalledWith(3));
  });

  it('disables every card\'s Duplicate button while one duplication is in flight', async () => {
    projectState.projects = [
      { id: 3, name: 'Neo-Tokyo', lastEdited: 'Just now', normsCount: 0, palette: [] },
      { id: 4, name: 'Retro Wave', lastEdited: 'Just now', normsCount: 0, palette: [] },
    ];
    // Never resolves within the test, so both buttons stay in the "busy" state
    // long enough to assert on it.
    let releaseDuplicate;
    projectState.duplicateProject = vi.fn(
      () => new Promise((resolve) => { releaseDuplicate = resolve; })
    );
    const user = userEvent.setup();
    renderPage();

    const [firstCardButton, secondCardButton] = screen.getAllByRole('button', { name: 'Duplicate project' });
    await user.click(firstCardButton);

    // Not just the clicked card: the OTHER card's button must also go disabled,
    // otherwise clicking it would silently no-op against the in-flight guard.
    await waitFor(() => expect(secondCardButton).toBeDisabled());
    expect(firstCardButton).toBeDisabled();

    releaseDuplicate({ id: 5, name: 'Neo-Tokyo (copy)' });
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
});
