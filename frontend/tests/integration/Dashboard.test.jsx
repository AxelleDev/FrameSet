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
      setActiveProjectId: vi.fn(),
      addProject: vi.fn().mockResolvedValue({ success: true }),
      duplicateProject: vi.fn(),
      deleteProject: vi.fn(),
      updateProjectName: vi.fn(),
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
});
