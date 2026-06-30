import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProjectExport from '../../src/pages/ProjectExport';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProjectExport />
    </MemoryRouter>
  );

describe('ProjectExport', () => {
  beforeEach(() => {
    Object.assign(projectState, {
      setActiveProjectId: vi.fn(),
      activeProject: { id: 2, name: 'Mon Projet', brushNorms: [], typographyNorms: [], palette: [] },
      projectsLoading: false,
      activeProjectId: '2',
    });
  });

  it('affiche les deux options d’export et l’aperçu JSON', () => {
    renderPage();
    expect(screen.getByText(/guide de style pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/données json/i)).toBeInTheDocument();
    expect(screen.getByText(/aperçu de la sortie json/i)).toBeInTheDocument();
    expect(screen.getByText(/Mon Projet/)).toBeInTheDocument();
  });

  it('déclenche le téléchargement JSON', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();
    await user.click(screen.getByRole('button', { name: /télécharger le json/i }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
