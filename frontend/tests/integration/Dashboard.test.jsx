import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
  useAuth: () => ({ user: { name: 'Prénom Nom', avatarInitials: 'PN' } }),
}));

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(projectState, {
      projects: [],
      setActiveProjectId: vi.fn(),
      addProject: vi.fn().mockResolvedValue({ success: true }),
      deleteProject: vi.fn(),
      updateProjectName: vi.fn(),
    });
  });

  it('affiche le prénom de la personne connectée', () => {
    renderPage();
    expect(screen.getByText(/Bonjour, Prénom\./i)).toBeInTheDocument();
  });

  it('crée un projet via la modale', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /créer un projet/i }));
    const input = await screen.findByPlaceholderText(/neo-tokyo/i);
    await user.type(input, 'Mon Projet');
    await user.click(screen.getByRole('button', { name: /^Créer$/ }));

    await waitFor(() => expect(projectState.addProject).toHaveBeenCalledWith('Mon Projet'));
  });
});
