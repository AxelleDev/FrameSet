import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import SharedProject from '../../src/pages/SharedProject';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../src/services/api', () => ({ default: apiMock }));

const renderPage = (token = 'a'.repeat(32)) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/s/${token}`]}>
        <Routes>
          <Route path="/s/:token" element={<SharedProject />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('SharedProject (public page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shared reference sheet: palette, typography and brushes', async () => {
    apiMock.get.mockResolvedValueOnce({
      name: 'Neo-Tokyo Editorial',
      ownerName: 'Axelle',
      palette: [{ id: 1, name: 'Ink', hex: '#112233' }],
      typographyNorms: [
        { id: 2, fontFamily: 'Figtree', fontWeight: '600', fontUsage: 'Heading', fontStyle: null },
      ],
      brushNorms: [
        // opacity is stored as a 0-1 decimal (validated server-side), not a percentage.
        { id: 3, name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 0.8 },
      ],
    });

    renderPage();

    expect(await screen.findByText('Neo-Tokyo Editorial')).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith(`/share/${'a'.repeat(32)}`, expect.any(Object));

    // Owner credit — the only personal info the public payload carries.
    expect(screen.getByText('Made by Axelle')).toBeInTheDocument();

    // Palette with copyable hex — same swatch layout as ProjectPalette.
    expect(screen.getByText('Ink')).toBeInTheDocument();
    expect(screen.getByText('#112233')).toBeInTheDocument();
    // Typography card: same Badge/value-line/preview-strip layout as ProjectNorms.
    // getByTitle (not getByText) for the family name: it also appears inside the
    // "Loading…" fallback text of the preview strip while the font hasn't loaded.
    expect(screen.getByTitle('Figtree')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    // Brush standard: same Badge/value-line/preview-strip layout as ProjectNorms.
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Smooth')).toBeInTheDocument();
    // Opacity shown as the raw 0-1 decimal, same as the internal editor — not "80%".
    expect(screen.getByText(/opacity: 0\.8/i)).toBeInTheDocument();
    // Growth footer pointing back to FrameSet.
    expect(screen.getByRole('link', { name: /create your own/i })).toBeInTheDocument();
  });

  it('shows a friendly state for a revoked or unknown link', async () => {
    const notFound = new Error('This link is no longer active.');
    notFound.status = 404;
    apiMock.get.mockRejectedValueOnce(notFound);

    renderPage();

    expect(await screen.findByText(/this link is no longer active/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /discover frameset/i })).toBeInTheDocument();
  });
});
