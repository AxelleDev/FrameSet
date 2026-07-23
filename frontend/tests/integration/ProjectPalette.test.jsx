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
      trashedPaletteColors: [],
      fetchTrashedColors: vi.fn(),
      deleteColor: vi.fn(),
      restoreColor: vi.fn(),
      deleteColorPermanently: vi.fn(),
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
    await user.click(screen.getByRole('button', { name: 'New color' }));
    // The add-color modal opens (its title is an <h3>, distinct from the tile button).
    expect(await screen.findByRole('heading', { name: 'New color' })).toBeInTheDocument();
  });

  it('moves a color to the trash via the single-color delete endpoint', async () => {
    projectState.deleteColor = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete color' }));
    await user.click(screen.getByRole('button', { name: 'Move to trash' }));

    expect(projectState.deleteColor).toHaveBeenCalledWith('2', 1);
  });

  it('shows the trash section and restores a color from it', async () => {
    projectState.trashedPaletteColors = [
      { id: 9, name: 'Old blush', hex: '#FCBFC4', deletedAt: '2026-07-10', daysLeft: 21 },
    ];
    projectState.restoreColor = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Old blush')).toBeInTheDocument();
    expect(screen.getByText(/21 days left/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(projectState.restoreColor).toHaveBeenCalledWith('2', 9);
  });

  it('permanently deletes a trashed color after its own confirmation', async () => {
    projectState.trashedPaletteColors = [
      { id: 9, name: 'Old blush', hex: '#FCBFC4', deletedAt: '2026-07-10', daysLeft: 3 },
    ];
    projectState.deleteColorPermanently = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument();
    const dialogButtons = screen.getAllByRole('button', { name: 'Delete forever' });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(projectState.deleteColorPermanently).toHaveBeenCalledWith('2', 9);
  });
});
