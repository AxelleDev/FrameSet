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
    </HelmetProvider>
  );

describe('SharedProject (public page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shared reference sheet: palette, typography and brushes', async () => {
    apiMock.get.mockResolvedValueOnce({
      name: 'Neo-Tokyo Editorial',
      palette: [{ id: 1, name: 'Ink', hex: '#112233' }],
      typographyNorms: [
        { id: 2, fontFamily: 'Figtree', fontWeight: '600', fontUsage: 'Heading', fontStyle: null },
      ],
      brushNorms: [
        { id: 3, name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth', opacity: 80 },
      ],
    });

    renderPage();

    expect(await screen.findByText('Neo-Tokyo Editorial')).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith(`/share/${'a'.repeat(32)}`, expect.any(Object));

    // Palette with copyable hex.
    expect(screen.getByText('Ink')).toBeInTheDocument();
    expect(screen.getByText('#112233')).toBeInTheDocument();
    // Typography with its usage badge and details.
    expect(screen.getByText('Figtree')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText(/weight 600/i)).toBeInTheDocument();
    // Brush standard with its value and details.
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText(/brush: smooth/i)).toBeInTheDocument();
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
