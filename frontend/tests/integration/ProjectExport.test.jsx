import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ProjectExport from '../../src/pages/ProjectExport';

const { projectState, pdfDoc } = vi.hoisted(() => ({
  projectState: {},
  // Every jsPDF method the PDF builder touches, as spies: the test asserts the
  // document is assembled and saved without rendering anything for real.
  pdfDoc: {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    roundedRect: vi.fn(),
    addPage: vi.fn(),
    addImage: vi.fn(),
    splitTextToSize: vi.fn((value) => [String(value)]),
    getTextWidth: vi.fn(() => 10),
    save: vi.fn(),
  },
}));

// The page imports jsPDF lazily (dynamic import); vitest mocks that too.
// A classic function (not an arrow) so `new jsPDF()` works.
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function jsPDF() {
    return pdfDoc;
  }),
}));

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

  it('builds and saves the PDF style guide under a filesystem-safe name', async () => {
    const user = userEvent.setup();
    // jsdom never loads images: a fake Image that fails immediately exercises
    // the "logo unavailable" fallback (the PDF must still be produced).
    const RealImage = globalThis.Image;
    vi.stubGlobal(
      'Image',
      class {
        set src(_value) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    projectState.activeProject = {
      ...projectState.activeProject,
      // "/" is invalid in a file name and must be stripped from the slug.
      name: 'Mon/Projet Été',
      palette: [{ id: 1, name: 'Coral', hex: '#FF6B63' }],
      brushNorms: [{ id: 2, name: 'Hair outline', value: '8', unit: 'px', opacity: 0.9 }],
      typographyNorms: [{ id: 3, fontFamily: 'Figtree', fontWeight: '700', fontUsage: 'Title' }],
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await vi.waitFor(() => expect(pdfDoc.save).toHaveBeenCalled());
    expect(pdfDoc.save).toHaveBeenCalledWith('monprojet_été_style_guide.pdf');
    // All three sections made it into the document.
    const drawnText = pdfDoc.text.mock.calls.map(([value]) => String(value)).join('\n');
    expect(drawnText).toContain('Color palette');
    expect(drawnText).toContain('Graphic standards');
    expect(drawnText).toContain('Made by Jane Doe');
    // No logo loaded -> no image embedded, and that must not block the export.
    expect(pdfDoc.addImage).not.toHaveBeenCalled();

    vi.stubGlobal('Image', RealImage);
    vi.unstubAllGlobals();
    pdfDoc.save.mockClear();
    pdfDoc.text.mockClear();
    pdfDoc.addImage.mockClear();
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
