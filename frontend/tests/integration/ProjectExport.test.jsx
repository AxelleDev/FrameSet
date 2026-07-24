import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ProjectExport from '../../src/pages/ProjectExport';

const { projectState } = vi.hoisted(() => ({ projectState: {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }) };
});

vi.mock('../../src/context/ProjectContext', () => ({
  useProjects: () => projectState,
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe' } }),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ProjectExport />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('ProjectExport', () => {
  beforeEach(() => {
    Object.assign(projectState, {
      setActiveProjectId: vi.fn(),
      activeProject: {
        id: 2,
        name: 'Mon Projet',
        brushNorms: [],
        typographyNorms: [],
        palette: [],
      },
      projectsLoading: false,
      activeProjectId: '2',
      enableSharing: vi.fn(),
      disableSharing: vi.fn(),
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

  it('hints to add colors instead of showing palette-file buttons when the palette is empty', () => {
    renderPage();
    expect(screen.getByText(/palette for your drawing app/i)).toBeInTheDocument();
    expect(screen.getByText(/add colors to this project/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /procreate/i })).not.toBeInTheDocument();
  });

  it('downloads the palette in each drawing-app format', async () => {
    const user = userEvent.setup();
    projectState.activeProject = {
      ...projectState.activeProject,
      palette: [{ id: 1, name: 'Coral', hex: '#FF6B63' }],
    };
    // jsdom implements neither object URLs nor real navigation: stub both ends
    // of the download (URL lifecycle + anchor click) and observe them.
    const createUrl = vi.fn().mockReturnValue('blob:mock');
    const revokeUrl = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(Object.create(URL), { createObjectURL: createUrl, revokeObjectURL: revokeUrl }),
    );
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();

    await user.click(screen.getByRole('button', { name: /photoshop \/ illustrator/i }));
    await user.click(screen.getByRole('button', { name: /krita \/ gimp/i }));
    await user.click(screen.getByRole('button', { name: /procreate/i }));

    expect(createUrl).toHaveBeenCalledTimes(3);
    expect(clickSpy).toHaveBeenCalledTimes(3);
    // Object URLs must be released after the click, or each export leaks memory.
    expect(revokeUrl).toHaveBeenCalledTimes(3);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('creates a share link when sharing is disabled', async () => {
    const user = userEvent.setup();
    projectState.enableSharing = vi.fn().mockResolvedValue('a'.repeat(32));
    renderPage();

    await user.click(screen.getByRole('button', { name: /create share link/i }));
    expect(projectState.enableSharing).toHaveBeenCalledWith(2);
  });

  it('shows the public URL and can disable sharing when a token exists', async () => {
    const user = userEvent.setup();
    projectState.activeProject = {
      ...projectState.activeProject,
      shareToken: 'b'.repeat(32),
    };
    projectState.disableSharing = vi.fn().mockResolvedValue(true);
    renderPage();

    expect(screen.getByTestId('share-url')).toHaveTextContent(`/s/${'b'.repeat(32)}`);

    await user.click(screen.getByRole('button', { name: /disable/i }));
    expect(projectState.disableSharing).toHaveBeenCalledWith(2);
  });
});
