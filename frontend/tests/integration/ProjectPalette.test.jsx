import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProjectPalette from '../../src/pages/ProjectPalette';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

vi.mock('../../src/hooks/useActiveProject', () => ({ default: () => {} }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProjectPalette />
    </MemoryRouter>
  );

describe('ProjectPalette', () => {
  beforeEach(() => {
    Object.assign(projectState, {
      activeProject: { id: '2', palette: [{ id: 1, name: 'Reflet', hex: '#FF0000' }] },
      updateProjectPalette: vi.fn().mockResolvedValue([{ id: 1, name: 'Reflet', hex: '#FF0000' }]),
      projectsLoading: false,
      activeProjectId: '2',
    });
  });

  it('affiche le titre, la couleur existante et le bouton d’import', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /palette de couleurs/i })).toBeInTheDocument();
    expect(screen.getByText('#FF0000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /palette depuis une image/i })).toBeInTheDocument();
  });

  it('ouvre la modale d’ajout de couleur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(/nouvelle couleur/i)).toBeInTheDocument();
  });
});
