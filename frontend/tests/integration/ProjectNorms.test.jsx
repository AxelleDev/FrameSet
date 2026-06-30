import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProjectNorms from '../../src/pages/ProjectNorms';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

vi.mock('../../src/hooks/useActiveProject', () => ({ default: () => {} }));
vi.mock('../../src/hooks/useGoogleFonts', () => ({
  default: () => ({ fonts: [], loading: false, error: null }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProjectNorms />
    </MemoryRouter>
  );

describe('ProjectNorms', () => {
  beforeEach(() => {
    Object.assign(projectState, {
      activeProject: { id: '2', brushNorms: [], typographyNorms: [] },
      addBrushNorm: vi.fn().mockResolvedValue({}),
      addTypographyNorm: vi.fn().mockResolvedValue({}),
      deleteBrushNorm: vi.fn(),
      deleteTypographyNorm: vi.fn(),
      updateBrushNorm: vi.fn(),
      updateTypographyNorm: vi.fn(),
      projectsLoading: false,
      activeProjectId: '2',
    });
  });

  it('affiche le titre et le filtre', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /normes graphiques/i })).toBeInTheDocument();
    expect(screen.getByText('Tout')).toBeInTheDocument();
  });

  it('ouvre la modale d’ajout de norme', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByPlaceholderText(/contour cheveux/i)).toBeInTheDocument();
  });
});
