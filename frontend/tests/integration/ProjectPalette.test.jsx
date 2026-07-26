import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ProjectPalette from '../../src/pages/ProjectPalette';
import { extractColorsFromImage } from '../../src/utils/extractColors';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

// Canvas-based extraction cannot run in jsdom; the flow around it can.
vi.mock('../../src/utils/extractColors', () => ({ extractColorsFromImage: vi.fn() }));

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
    <HelmetProvider>
      <MemoryRouter>
        <ProjectPalette />
      </MemoryRouter>
    </HelmetProvider>,
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

  it('copies a color in another format from the hex caption menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /copy #FF0000 in another format/i }));
    await user.click(screen.getByRole('menuitem', { name: /hsb/i }));

    // #FF0000 as the HSB values a Procreate user would dial in.
    expect(writeText).toHaveBeenCalledWith('0°, 100%, 100%');
  });

  it('adds a color through the modal and persists the whole ordered palette', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'New color' }));
    await user.type(screen.getByLabelText(/color name/i), 'Sunset');
    // The color field (defaults to HEX) normalizes as you type (leading '#', uppercase).
    await user.type(screen.getByLabelText('Color'), 'aabbcc');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(projectState.updateProjectPalette).toHaveBeenCalledWith('2', [
      { id: 1, name: 'Reflet', hex: '#FF0000' },
      { name: 'Sunset', hex: '#AABBCC' },
    ]);
  });

  it('generates harmonies from a base color and adds a picked suggestion', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Harmonies' }));
    // The base defaults to the first palette color (#FF0000); its complement is cyan.
    await user.click(screen.getByRole('button', { name: 'Complementary, #00FFFF' }));
    await user.click(screen.getByRole('button', { name: 'Add (1)' }));

    expect(projectState.updateProjectPalette).toHaveBeenCalledWith('2', [
      { id: 1, name: 'Reflet', hex: '#FF0000' },
      { name: 'Complementary', hex: '#00FFFF' },
    ]);
  });

  it('edits a color in place, keeping its id', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit color' }));
    const nameField = screen.getByDisplayValue('Reflet');
    await user.clear(nameField);
    await user.type(nameField, 'Rouge vif');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(projectState.updateProjectPalette).toHaveBeenCalledWith('2', [
      { id: 1, name: 'Rouge vif', hex: '#FF0000' },
    ]);
  });

  it('imports colors from an image: extract, deselect one, add the rest', async () => {
    const user = userEvent.setup();
    extractColorsFromImage.mockResolvedValueOnce(['#111111', '#222222']);
    const { container } = renderPage();

    // The picker button drives a hidden file input; feed it a file directly.
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(['img'], 'ref.png', { type: 'image/png' })] },
    });

    // Both extracted colors show up selected; deselect the first one.
    const firstSwatch = await screen.findByRole('button', { name: /#111111/ });
    expect(firstSwatch).toHaveAttribute('aria-pressed', 'true');
    await user.click(firstSwatch);
    expect(firstSwatch).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /add \(1\)/i }));

    expect(projectState.updateProjectPalette).toHaveBeenCalledWith('2', [
      { id: 1, name: 'Reflet', hex: '#FF0000' },
      { name: 'Color 2', hex: '#222222' },
    ]);
  });

  it('imports a .gpl palette file: parsed colors preview with their names, then add', async () => {
    const user = userEvent.setup();
    const gpl = 'GIMP Palette\nName: Krita export\n#\n255 0 0\tSignal Red\n0 0 255\tDeep Blue\n';
    const { container } = renderPage();

    const fileInput = container.querySelector('input[accept=".ase,.gpl,.swatches"]');
    fireEvent.change(fileInput, {
      target: { files: [new File([gpl], 'krita.gpl', { type: 'application/octet-stream' })] },
    });

    // Both parsed colors show up, named, selected by default.
    expect(await screen.findByText('Signal Red')).toBeInTheDocument();
    expect(screen.getByText('Deep Blue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add \(2\)/i }));

    expect(projectState.updateProjectPalette).toHaveBeenCalledWith('2', [
      { id: 1, name: 'Reflet', hex: '#FF0000' },
      { name: 'Signal Red', hex: '#FF0000' },
      { name: 'Deep Blue', hex: '#0000FF' },
    ]);
  });

  it('accepts a palette file dropped anywhere on the page', async () => {
    const gpl = 'GIMP Palette\n#\n0 255 0\tLime\n';
    const { container } = renderPage();

    fireEvent.drop(container.querySelector('[data-testid="palette-dropzone"]'), {
      dataTransfer: { files: [new File([gpl], 'drop.gpl')] },
    });

    expect(await screen.findByText('Lime')).toBeInTheDocument();
  });

  it('reports a malformed palette file with the parser message', async () => {
    const { container } = renderPage();

    const fileInput = container.querySelector('input[accept=".ase,.gpl,.swatches"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(['not a palette'], 'junk.gpl')] },
    });

    expect(await screen.findByText(/not a gimp palette/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /import a palette/i })).not.toBeInTheDocument();
  });

  it('reports an unreadable image without opening the modal', async () => {
    extractColorsFromImage.mockRejectedValueOnce(new Error('bad image'));
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'broken.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText(/could not be analyzed/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /palette from an image/i }),
    ).not.toBeInTheDocument();
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
