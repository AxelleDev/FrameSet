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

  it('shows both export options and the JSON preview', () => {
    renderPage();
    expect(screen.getByText(/pdf style guide/i)).toBeInTheDocument();
    expect(screen.getByText(/json data/i)).toBeInTheDocument();
    expect(screen.getByText(/json output preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Mon Projet/)).toBeInTheDocument();
  });

  it('triggers the JSON download', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();
    await user.click(screen.getByRole('button', { name: /download json/i }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
