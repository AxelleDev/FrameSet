import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ProjectNorms from '../../src/pages/ProjectNorms';

const { projectState, googleFontsState } = vi.hoisted(() => ({
  projectState: {},
  googleFontsState: { fonts: [], loading: false, error: null },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

vi.mock('../../src/hooks/useActiveProject', () => ({ default: () => {} }));
vi.mock('../../src/hooks/useGoogleFonts', () => ({
  default: () => googleFontsState,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ProjectNorms />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('ProjectNorms', () => {
  beforeEach(() => {
    Object.assign(googleFontsState, {
      fonts: [
        { family: 'Roboto', variants: ['regular', '700'] },
        { family: 'Roboto Slab', variants: ['regular'] },
        { family: 'Open Sans', variants: ['regular'] },
        { family: 'Lobster', variants: ['regular'] },
      ],
      loading: false,
      error: null,
    });
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
      trashedBrushNorms: [],
      trashedTypographyNorms: [],
      fetchTrashedBrushNorms: vi.fn(),
      fetchTrashedTypographyNorms: vi.fn(),
      restoreBrushNorm: vi.fn(),
      restoreTypographyNorm: vi.fn(),
      deleteBrushNormPermanently: vi.fn(),
      deleteTypographyNormPermanently: vi.fn(),
      reorderBrushNorms: vi.fn().mockResolvedValue(true),
      reorderTypographyNorms: vi.fn().mockResolvedValue(true),
    });
  });

  it('shows the title and the filter', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /graphic standards/i })).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('opens the add-standard modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByPlaceholderText(/hair outline/i)).toBeInTheDocument();
  });

  it('moves a standard to the trash after confirmation', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [{ id: 5, name: 'Hair outline', value: '8', unit: 'px', opacity: 0.9 }],
      typographyNorms: [],
    };
    projectState.deleteBrushNorm = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete standard' }));
    await user.click(screen.getByRole('button', { name: 'Move to trash' }));

    expect(projectState.deleteBrushNorm).toHaveBeenCalledWith('2', 5);
  });

  it('edits a brush standard through the pre-filled modal', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 0.9 },
      ],
      typographyNorms: [],
    };
    projectState.updateBrushNorm = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit standard' }));
    // The modal opens pre-filled from the standard being edited.
    const usageInput = await screen.findByLabelText('Brush usage');
    expect(usageInput).toHaveValue('Hair outline');
    const sizeInput = screen.getByLabelText('Size (px)');
    await user.clear(sizeInput);
    await user.type(sizeInput, '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(projectState.updateBrushNorm).toHaveBeenCalledWith('2', 5, {
      name: 'Hair outline',
      value: '12',
      unit: 'px',
      brushName: 'Smooth',
      opacity: 0.9,
    });
    // The modal closed on success.
    expect(screen.queryByLabelText('Brush usage')).not.toBeInTheDocument();
  });

  it('warns about a duplicate brush usage without blocking the add', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 0.9 },
      ],
      typographyNorms: [],
    };
    projectState.addBrushNorm = vi.fn().mockResolvedValue({ id: 6 });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    const usageInput = await screen.findByLabelText('Brush usage');
    await user.type(usageInput, 'hair outline'); // case-insensitive match

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

    // Informative only — adding the duplicate still works.
    await user.type(screen.getByLabelText('Size (px)'), '4');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(projectState.addBrushNorm).toHaveBeenCalled();
  });

  it('does not warn when editing a standard kept on its own usage', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 0.9 },
      ],
      typographyNorms: [],
    };
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit standard' }));
    await screen.findByLabelText('Brush usage');

    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });

  it('keeps the edit modal open when the save fails, preserving the edits', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [{ id: 5, name: 'Hair outline', value: '8', unit: 'px', opacity: 0.9 }],
      typographyNorms: [],
    };
    projectState.updateBrushNorm = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit standard' }));
    const sizeInput = await screen.findByLabelText('Size (px)');
    await user.clear(sizeInput);
    await user.type(sizeInput, '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Still open, with the typed value preserved for a retry.
    expect(screen.getByLabelText('Size (px)')).toHaveValue(12);
  });

  it('duplicates a brush standard with a "(copy)" name and the same values', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 0.9 },
      ],
      typographyNorms: [],
    };
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Duplicate standard' }));

    expect(projectState.addBrushNorm).toHaveBeenCalledWith('2', {
      name: 'Hair outline (copy)',
      value: '8',
      unit: 'px',
      brushName: 'Smooth',
      opacity: 0.9,
    });
  });

  it('duplicates a typography standard, suffixing the usage', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [],
      typographyNorms: [
        { id: 11, fontFamily: 'Inter', fontWeight: '700', fontUsage: 'Body', fontStyle: 'Italic' },
      ],
    };
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Duplicate standard' }));

    expect(projectState.addTypographyNorm).toHaveBeenCalledWith('2', {
      fontFamily: 'Inter',
      fontWeight: '700',
      fontUsage: 'Body (copy)',
      fontStyle: 'Italic',
    });
  });

  it('shows the trash section (brush + typography together, newest first) and restores an item', async () => {
    projectState.trashedBrushNorms = [
      {
        id: 9,
        name: 'Old outline',
        value: '8',
        unit: 'px',
        opacity: 0.9,
        deletedAt: '2026-07-10T00:00:00Z',
        daysLeft: 21,
      },
    ];
    projectState.trashedTypographyNorms = [
      {
        id: 4,
        fontFamily: 'Figtree',
        fontUsage: 'Heading',
        deletedAt: '2026-07-05T00:00:00Z',
        daysLeft: 16,
      },
    ];
    projectState.restoreBrushNorm = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Old outline')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();

    // Newest first: the brush item (2026-07-10) sorts before the typography
    // item (2026-07-05), so the first "Restore" button belongs to the brush norm.
    const [firstRestore] = screen.getAllByRole('button', { name: 'Restore' });
    await user.click(firstRestore);
    expect(projectState.restoreBrushNorm).toHaveBeenCalledWith('2', 9);
  });

  it('permanently deletes a trashed standard after its own confirmation', async () => {
    projectState.trashedBrushNorms = [
      {
        id: 9,
        name: 'Old outline',
        value: '8',
        unit: 'px',
        opacity: 0.9,
        deletedAt: '2026-07-10',
        daysLeft: 3,
      },
    ];
    projectState.deleteBrushNormPermanently = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument();
    const dialogButtons = screen.getAllByRole('button', { name: 'Delete forever' });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(projectState.deleteBrushNormPermanently).toHaveBeenCalledWith('2', 9);
  });

  it('reorders brush standards via the move-right button', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', opacity: 0.9 },
        { id: 6, name: 'Shadow', value: '4', unit: 'px', opacity: 0.5 },
      ],
      typographyNorms: [],
    };
    const user = userEvent.setup();
    renderPage();

    const [moveRight] = screen.getAllByRole('button', { name: 'Move standard right' });
    await user.click(moveRight);

    expect(projectState.reorderBrushNorms).toHaveBeenCalledWith('2', [6, 5]);
  });

  it('reorders typography standards independently from brush standards', async () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [],
      typographyNorms: [
        { id: 11, fontFamily: 'Inter', fontUsage: 'Body' },
        { id: 12, fontFamily: 'Figtree', fontUsage: 'Heading' },
      ],
    };
    const user = userEvent.setup();
    renderPage();

    const [moveRight] = screen.getAllByRole('button', { name: 'Move standard right' });
    await user.click(moveRight);

    expect(projectState.reorderTypographyNorms).toHaveBeenCalledWith('2', [12, 11]);
    expect(projectState.reorderBrushNorms).not.toHaveBeenCalled();
  });

  it('disables the move-left button on the first standard and move-right on the last', () => {
    projectState.activeProject = {
      id: '2',
      brushNorms: [
        { id: 5, name: 'Hair outline', value: '8', unit: 'px', opacity: 0.9 },
        { id: 6, name: 'Shadow', value: '4', unit: 'px', opacity: 0.5 },
      ],
      typographyNorms: [],
    };
    renderPage();

    const [firstLeft, secondLeft] = screen.getAllByRole('button', { name: 'Move standard left' });
    const [firstRight, secondRight] = screen.getAllByRole('button', {
      name: 'Move standard right',
    });
    expect(firstLeft).toBeDisabled();
    expect(secondLeft).not.toBeDisabled();
    expect(firstRight).not.toBeDisabled();
    expect(secondRight).toBeDisabled();
  });

  it('lets you search the font list instead of scrolling it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    // Switch the "Type" field to Typography, revealing the font picker.
    await user.click(screen.getByText('Brush'));
    await user.click(await screen.findByText('Typography'));

    const comboboxes = screen.getAllByRole('combobox');
    const fontInput = comboboxes[comboboxes.length - 1];
    await user.click(fontInput);
    expect(screen.getByText('Open Sans')).toBeInTheDocument();

    await user.type(fontInput, 'rob');

    expect(screen.getByText('Roboto')).toBeInTheDocument();
    expect(screen.getByText('Roboto Slab')).toBeInTheDocument();
    expect(screen.queryByText('Open Sans')).not.toBeInTheDocument();
    expect(screen.queryByText('Lobster')).not.toBeInTheDocument();

    await user.click(screen.getByText('Roboto Slab'));
    expect(screen.getByText('Roboto Slab')).toBeInTheDocument();
  });
});
