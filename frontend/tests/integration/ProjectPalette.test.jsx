import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
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
    <HelmetProvider><MemoryRouter>
      <ProjectPalette />
    </MemoryRouter></HelmetProvider>
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

  it('shows the title, the existing color and the import button', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /color palette/i })).toBeInTheDocument();
    expect(screen.getByText('#FF0000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /palette from an image/i })).toBeInTheDocument();
  });

  it('opens the add-color modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(/new color/i)).toBeInTheDocument();
  });
});
