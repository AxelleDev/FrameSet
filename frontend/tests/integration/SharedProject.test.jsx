import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
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

  describe('live updates (SSE)', () => {
    // Minimal EventSource stand-in: captures the connected URL and lets the
    // test drive open/changed events by hand.
    let sources;
    class FakeEventSource {
      constructor(url) {
        this.url = url;
        this.listeners = {};
        this.closed = false;
        sources.push(this);
      }

      addEventListener(type, cb) {
        this.listeners[type] = cb;
      }

      close() {
        this.closed = true;
      }

      emitOpen() {
        this.onopen?.();
      }

      emit(type) {
        this.listeners[type]?.();
      }
    }

    beforeEach(() => {
      sources = [];
      vi.stubGlobal('EventSource', FakeEventSource);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const sheet = (overrides = {}) => ({
      name: 'Neo-Tokyo Editorial',
      ownerName: 'Axelle',
      palette: [{ id: 1, name: 'Ink', hex: '#112233' }],
      typographyNorms: [],
      brushNorms: [],
      ...overrides,
    });

    it('subscribes once loaded, shows the Live badge and applies edits in place', async () => {
      apiMock.get.mockResolvedValueOnce(sheet());
      renderPage();
      expect(await screen.findByText('Ink')).toBeInTheDocument();

      // The stream targets the share events endpoint for this token.
      await waitFor(() => expect(sources).toHaveLength(1));
      expect(sources[0].url).toContain(`/share/${'a'.repeat(32)}/events`);

      await act(async () => sources[0].emitOpen());
      expect(screen.getByText('Live')).toBeInTheDocument();

      // Owner edits: a changed ping makes the page refetch and swap the sheet
      // in place — no loading state in between.
      apiMock.get.mockResolvedValueOnce(
        sheet({ palette: [{ id: 1, name: 'Ink Renamed', hex: '#112233' }] }),
      );
      await act(async () => sources[0].emit('changed'));

      expect(await screen.findByText('Ink Renamed')).toBeInTheDocument();
      expect(screen.queryByText('Ink')).not.toBeInTheDocument();
      expect(apiMock.get).toHaveBeenCalledTimes(2);
    });

    it('a live revocation flips the page to the inactive state', async () => {
      apiMock.get.mockResolvedValueOnce(sheet());
      renderPage();
      expect(await screen.findByText('Ink')).toBeInTheDocument();

      await waitFor(() => expect(sources).toHaveLength(1));
      const notFound = new Error('gone');
      notFound.status = 404;
      apiMock.get.mockRejectedValueOnce(notFound);
      await act(async () => sources[0].emit('changed'));

      expect(await screen.findByText(/this link is no longer active/i)).toBeInTheDocument();
    });
  });
});
