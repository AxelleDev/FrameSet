import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiMock, authState } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authState: { user: { id: 1 }, authLoading: false, setGlobalError: vi.fn() },
}));
vi.mock('../../src/services/api', () => ({ default: apiMock }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => authState }));

import { ProjectProvider, useProjects } from '../../src/context/ProjectContext';

const wrapper = ({ children }) => <ProjectProvider>{children}</ProjectProvider>;

describe('ProjectContext mutations return success signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The provider fetches page 1 on mount.
    apiMock.get.mockResolvedValue({
      projects: [],
      pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    });
  });

  it('addProject returns the created project and prepends it', async () => {
    apiMock.post.mockResolvedValueOnce({ id: 7, name: 'New' });
    const { result } = renderHook(() => useProjects(), { wrapper });

    let returned;
    await act(async () => {
      returned = await result.current.addProject('New');
    });

    expect(returned).toEqual({ id: 7, name: 'New' });
    expect(result.current.projects[0]).toEqual({ id: 7, name: 'New' });
  });

  it('addProject returns null when the request fails', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useProjects(), { wrapper });

    let returned;
    await act(async () => {
      returned = await result.current.addProject('X');
    });

    expect(returned).toBeNull();
  });

  it('duplicateProject prepends the server copy and returns it', async () => {
    apiMock.post.mockResolvedValueOnce({ id: 9, name: 'New (copy)', normsCount: 2 });
    const { result } = renderHook(() => useProjects(), { wrapper });

    let returned;
    await act(async () => {
      returned = await result.current.duplicateProject(7);
    });

    expect(apiMock.post).toHaveBeenCalledWith('/projects/7/duplicate', {}, expect.any(Object));
    expect(returned).toEqual({ id: 9, name: 'New (copy)', normsCount: 2 });
    expect(result.current.projects[0]).toEqual({ id: 9, name: 'New (copy)', normsCount: 2 });
  });

  it('duplicateProject returns null when the request fails', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useProjects(), { wrapper });

    let returned;
    await act(async () => {
      returned = await result.current.duplicateProject(7);
    });

    expect(returned).toBeNull();
    expect(result.current.projects).toEqual([]);
  });

  it('restoreProject removes the item from the trash and refetches the grid', async () => {
    apiMock.get.mockResolvedValue({
      projects: [{ id: 3, name: 'Restored' }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    const { result } = renderHook(() => useProjects(), { wrapper });

    apiMock.post.mockResolvedValueOnce({ success: true });
    let ok;
    await act(async () => {
      ok = await result.current.restoreProject(3);
    });

    expect(ok).toBe(true);
    expect(apiMock.post).toHaveBeenCalledWith('/projects/3/restore', {}, expect.any(Object));
    // The restored project came back through the silent refetch.
    expect(result.current.projects).toEqual([{ id: 3, name: 'Restored' }]);
  });

  it('restoreProject refetches every loaded page, not just the first', async () => {
    // Two pages already loaded before the restore (e.g. the user clicked "Load
    // more" once): page 1 has 2 of 3 items, page 2 has the 3rd.
    apiMock.get
      .mockResolvedValueOnce({
        projects: [
          { id: 1, name: 'P1' },
          { id: 2, name: 'P2' },
        ],
        pagination: { page: 1, pageSize: 2, total: 3, totalPages: 2 },
      }) // mount fetch (page 1)
      .mockResolvedValueOnce({
        projects: [{ id: 3, name: 'P3' }],
        pagination: { page: 2, pageSize: 2, total: 3, totalPages: 2 },
      }); // fetchProjects({ page: 2 })

    const { result } = renderHook(() => useProjects(), { wrapper });
    await act(async () => {}); // mount fetch settles

    await act(async () => {
      await result.current.fetchProjects({ page: 2 });
    });
    expect(result.current.projects).toHaveLength(3);
    expect(result.current.projectsPagination.page).toBe(2);

    // Restoring a trashed project: its position in server order isn't known
    // locally, so both previously-loaded pages must be refetched — the server
    // now reports 4 projects total, split differently across the same 2 pages.
    apiMock.post.mockResolvedValueOnce({ success: true }); // POST .../restore
    apiMock.get
      .mockResolvedValueOnce({
        projects: [
          { id: 1, name: 'P1' },
          { id: 99, name: 'Restored' },
        ],
        pagination: { page: 1, pageSize: 2, total: 4, totalPages: 2 },
      }) // refetch page 1
      .mockResolvedValueOnce({
        projects: [
          { id: 2, name: 'P2' },
          { id: 3, name: 'P3' },
        ],
        pagination: { page: 2, pageSize: 2, total: 4, totalPages: 2 },
      }); // refetch page 2

    await act(async () => {
      await result.current.restoreProject(99);
    });

    // The grid reflects BOTH refetched pages (4 items) — a naive "refetch page
    // 1 only" would have collapsed it down to 2 and dropped id 3 entirely.
    expect(result.current.projects.map((p) => p.id)).toEqual([1, 99, 2, 3]);
    expect(result.current.projectsPagination.total).toBe(4);
  });

  it('deleteProjectPermanently returns a boolean and prunes the trash list', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    apiMock.delete.mockResolvedValueOnce({ success: true });
    let ok;
    await act(async () => {
      ok = await result.current.deleteProjectPermanently(9);
    });
    expect(ok).toBe(true);
    expect(apiMock.delete).toHaveBeenCalledWith('/projects/9/permanent', null, expect.any(Object));

    apiMock.delete.mockRejectedValueOnce(new Error('no'));
    await act(async () => {
      ok = await result.current.deleteProjectPermanently(9);
    });
    expect(ok).toBe(false);
  });

  it('fetchTrashedProjects stores the trashed list', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    apiMock.get.mockResolvedValueOnce({
      projects: [{ id: 9, name: 'Old poster', deletedAt: '2026-07-10', daysLeft: 21 }],
    });
    await act(async () => {
      await result.current.fetchTrashedProjects();
    });

    expect(result.current.trashedProjects).toEqual([
      { id: 9, name: 'Old poster', deletedAt: '2026-07-10', daysLeft: 21 },
    ]);
  });

  it('trash fetchers keep a stable identity after a fetch stores its result', async () => {
    // Regression guard: the pages load the trash in an effect that depends on
    // the fetcher, so a fetcher whose identity changes whenever the trash state
    // it just stored changes would re-trigger that effect after every response —
    // an endless request loop.
    const { result } = renderHook(() => useProjects(), { wrapper });

    const before = {
      projects: result.current.fetchTrashedProjects,
      colors: result.current.fetchTrashedColors,
      brush: result.current.fetchTrashedBrushNorms,
      typography: result.current.fetchTrashedTypographyNorms,
    };

    apiMock.get.mockResolvedValueOnce({ projects: [{ id: 9, name: 'Old', daysLeft: 21 }] });
    apiMock.get.mockResolvedValueOnce({ colors: [{ id: 4, name: 'Teal', hex: '#008080' }] });
    apiMock.get.mockResolvedValueOnce({ norms: [{ id: 5, name: 'Lineart' }] });
    apiMock.get.mockResolvedValueOnce({ norms: [{ id: 6, fontFamily: 'Figtree' }] });
    await act(async () => {
      await result.current.fetchTrashedProjects();
      await result.current.fetchTrashedColors(3);
      await result.current.fetchTrashedBrushNorms(3);
      await result.current.fetchTrashedTypographyNorms(3);
    });

    expect(result.current.fetchTrashedProjects).toBe(before.projects);
    expect(result.current.fetchTrashedColors).toBe(before.colors);
    expect(result.current.fetchTrashedBrushNorms).toBe(before.brush);
    expect(result.current.fetchTrashedTypographyNorms).toBe(before.typography);
  });

  it('enableSharing stores the minted token on the project', async () => {
    apiMock.get.mockResolvedValue({
      projects: [{ id: 3, name: 'P', shareToken: null }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    const { result } = renderHook(() => useProjects(), { wrapper });
    // Wait for the mount fetch to populate the list.
    await act(async () => {});

    apiMock.post.mockResolvedValueOnce({ shareToken: 'tok123' });
    let token;
    await act(async () => {
      token = await result.current.enableSharing(3);
    });

    expect(apiMock.post).toHaveBeenCalledWith('/projects/3/share', {}, expect.any(Object));
    expect(token).toBe('tok123');
    expect(result.current.projects[0].shareToken).toBe('tok123');
  });

  it('disableSharing clears the token and returns a boolean', async () => {
    apiMock.get.mockResolvedValue({
      projects: [{ id: 3, name: 'P', shareToken: 'tok123' }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    const { result } = renderHook(() => useProjects(), { wrapper });
    await act(async () => {});

    apiMock.delete.mockResolvedValueOnce({ success: true });
    let ok;
    await act(async () => {
      ok = await result.current.disableSharing(3);
    });

    expect(apiMock.delete).toHaveBeenCalledWith('/projects/3/share', null, expect.any(Object));
    expect(ok).toBe(true);
    expect(result.current.projects[0].shareToken).toBeNull();
  });

  it('deleteProject returns true on success and false on failure', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    apiMock.delete.mockResolvedValueOnce({});
    let ok;
    await act(async () => {
      ok = await result.current.deleteProject(1);
    });
    expect(ok).toBe(true);

    apiMock.delete.mockRejectedValueOnce(new Error('no'));
    await act(async () => {
      ok = await result.current.deleteProject(2);
    });
    expect(ok).toBe(false);
  });

  it('updateBrushNorm and updateProjectName return a boolean result', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    apiMock.put.mockResolvedValueOnce({ success: true });
    let brushOk;
    await act(async () => {
      brushOk = await result.current.updateBrushNorm(1, 2, { name: 'x' });
    });
    expect(brushOk).toBe(true);

    apiMock.patch.mockRejectedValueOnce(new Error('nope'));
    let renameOk;
    await act(async () => {
      renameOk = await result.current.updateProjectName(1, { name: 'y' });
    });
    expect(renameOk).toBe(false);
  });

  describe('color trash', () => {
    it('deleteColor removes the color locally via the single-color endpoint and refreshes the trash', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', palette: [{ id: 10, name: 'Ink', hex: '#112233' }] }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await act(async () => {});

      apiMock.delete.mockResolvedValueOnce({ success: true });
      apiMock.get.mockResolvedValueOnce({ colors: [] }); // silent trash refresh
      let ok;
      await act(async () => {
        ok = await result.current.deleteColor(3, 10);
      });

      expect(ok).toBe(true);
      expect(apiMock.delete).toHaveBeenCalledWith(
        '/projects/3/palette/10',
        null,
        expect.any(Object),
      );
      expect(result.current.projects[0].palette).toEqual([]);
    });

    it('fetchTrashedColors stores the trashed list', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.get.mockResolvedValueOnce({
        colors: [
          { id: 9, name: 'Old blush', hex: '#FCBFC4', deletedAt: '2026-07-10', daysLeft: 21 },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedColors(3);
      });

      expect(result.current.trashedPaletteColors).toEqual([
        { id: 9, name: 'Old blush', hex: '#FCBFC4', deletedAt: '2026-07-10', daysLeft: 21 },
      ]);
    });

    it('restoreColor appends the restored color back to the project palette', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', palette: [] }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await act(async () => {});

      apiMock.get.mockResolvedValueOnce({
        colors: [
          { id: 9, name: 'Old blush', hex: '#FCBFC4', deletedAt: '2026-07-10', daysLeft: 21 },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedColors(3);
      });

      apiMock.post.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.restoreColor(3, 9);
      });

      expect(ok).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/3/palette/9/restore',
        {},
        expect.any(Object),
      );
      expect(result.current.trashedPaletteColors).toEqual([]);
      expect(result.current.projects[0].palette).toEqual([
        { id: 9, name: 'Old blush', hex: '#FCBFC4' },
      ]);
    });

    it('deleteColorPermanently prunes the trash list and returns a boolean', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.delete.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.deleteColorPermanently(3, 9);
      });
      expect(ok).toBe(true);
      expect(apiMock.delete).toHaveBeenCalledWith(
        '/projects/3/palette/9/permanent',
        null,
        expect.any(Object),
      );

      apiMock.delete.mockRejectedValueOnce(new Error('no'));
      await act(async () => {
        ok = await result.current.deleteColorPermanently(3, 9);
      });
      expect(ok).toBe(false);
    });
  });

  describe('brush/typography norm trash', () => {
    it('fetchTrashedBrushNorms and fetchTrashedTypographyNorms store their lists', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.get.mockResolvedValueOnce({
        norms: [
          {
            id: 9,
            name: 'Outline',
            value: '8',
            unit: 'px',
            brushName: 'Smooth',
            opacity: 0.5,
            deletedAt: 'x',
            daysLeft: 5,
          },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedBrushNorms(3);
      });
      expect(result.current.trashedBrushNorms).toHaveLength(1);

      apiMock.get.mockResolvedValueOnce({
        norms: [
          { id: 4, fontFamily: 'Figtree', fontUsage: 'Heading', deletedAt: 'x', daysLeft: 5 },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedTypographyNorms(3);
      });
      expect(result.current.trashedTypographyNorms).toHaveLength(1);
    });

    it('restoreBrushNorm appends the restored norm back and bumps normsCount', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', brushNorms: [], normsCount: 0 }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await act(async () => {});

      apiMock.get.mockResolvedValueOnce({
        norms: [
          {
            id: 9,
            name: 'Outline',
            value: '8',
            unit: 'px',
            brushName: 'Smooth',
            opacity: 0.5,
            deletedAt: 'x',
            daysLeft: 5,
          },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedBrushNorms(3);
      });

      apiMock.post.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.restoreBrushNorm(3, 9);
      });

      expect(ok).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/3/brush-norms/9/restore',
        {},
        expect.any(Object),
      );
      expect(result.current.trashedBrushNorms).toEqual([]);
      expect(result.current.projects[0].brushNorms).toHaveLength(1);
      expect(result.current.projects[0].normsCount).toBe(1);
    });

    it('restoreTypographyNorm appends the restored norm back and bumps normsCount', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', typographyNorms: [], normsCount: 0 }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await act(async () => {});

      apiMock.get.mockResolvedValueOnce({
        norms: [
          { id: 4, fontFamily: 'Figtree', fontUsage: 'Heading', deletedAt: 'x', daysLeft: 5 },
        ],
      });
      await act(async () => {
        await result.current.fetchTrashedTypographyNorms(3);
      });

      apiMock.post.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.restoreTypographyNorm(3, 4);
      });

      expect(ok).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/3/typography-norms/4/restore',
        {},
        expect.any(Object),
      );
      expect(result.current.trashedTypographyNorms).toEqual([]);
      expect(result.current.projects[0].typographyNorms).toHaveLength(1);
      expect(result.current.projects[0].normsCount).toBe(1);
    });

    it('deleteBrushNormPermanently and deleteTypographyNormPermanently prune their trash lists', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.delete.mockResolvedValueOnce({ success: true });
      let brushOk;
      await act(async () => {
        brushOk = await result.current.deleteBrushNormPermanently(3, 9);
      });
      expect(brushOk).toBe(true);
      expect(apiMock.delete).toHaveBeenCalledWith(
        '/projects/3/brush-norms/9/permanent',
        null,
        expect.any(Object),
      );

      apiMock.delete.mockResolvedValueOnce({ success: true });
      let typoOk;
      await act(async () => {
        typoOk = await result.current.deleteTypographyNormPermanently(3, 4);
      });
      expect(typoOk).toBe(true);
      expect(apiMock.delete).toHaveBeenCalledWith(
        '/projects/3/typography-norms/4/permanent',
        null,
        expect.any(Object),
      );
    });
  });

  describe('pinning, reordering and search', () => {
    it('pinProject marks the project pinned and moves it after other pinned projects', async () => {
      apiMock.get.mockResolvedValueOnce({
        projects: [
          { id: 1, name: 'Already pinned', pinned: true },
          { id: 2, name: 'Not pinned', pinned: false },
        ],
        pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(2));

      apiMock.post.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.pinProject(2);
      });

      expect(ok).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith('/projects/2/pin', {}, expect.any(Object));
      expect(result.current.projects.map((p) => p.id)).toEqual([1, 2]);
      expect(result.current.projects.find((p) => p.id === 2).pinned).toBe(true);
    });

    it('unpinProject clears the pinned flag', async () => {
      apiMock.get.mockResolvedValueOnce({
        projects: [{ id: 1, name: 'Pinned', pinned: true }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      apiMock.delete.mockResolvedValueOnce({ success: true });
      let ok;
      await act(async () => {
        ok = await result.current.unpinProject(1);
      });

      expect(ok).toBe(true);
      expect(apiMock.delete).toHaveBeenCalledWith('/projects/1/pin', null, expect.any(Object));
      expect(result.current.projects[0].pinned).toBe(false);
    });

    it('reorderPinnedProjects posts the ordered id list', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      apiMock.post.mockResolvedValueOnce({ success: true });

      let ok;
      await act(async () => {
        ok = await result.current.reorderPinnedProjects([4, 2]);
      });

      expect(ok).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/pinned/reorder',
        [4, 2],
        expect.any(Object),
      );
    });

    it('reorderPinnedProjects returns false when the request fails', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      apiMock.post.mockRejectedValueOnce(new Error('boom'));

      let ok;
      await act(async () => {
        ok = await result.current.reorderPinnedProjects([4, 2]);
      });

      expect(ok).toBe(false);
    });

    it('reorderBrushNorms and reorderTypographyNorms post to their own endpoints', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.post.mockResolvedValueOnce({ success: true });
      let brushOk;
      await act(async () => {
        brushOk = await result.current.reorderBrushNorms(3, [9, 8]);
      });
      expect(brushOk).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/3/brush-norms/reorder',
        [9, 8],
        expect.any(Object),
      );

      apiMock.post.mockResolvedValueOnce({ success: true });
      let typoOk;
      await act(async () => {
        typoOk = await result.current.reorderTypographyNorms(3, [5, 6]);
      });
      expect(typoOk).toBe(true);
      expect(apiMock.post).toHaveBeenCalledWith(
        '/projects/3/typography-norms/reorder',
        [5, 6],
        expect.any(Object),
      );
    });

    it('fetchProjects includes the search term in the request and remembers it for later pages', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      apiMock.get.mockResolvedValueOnce({
        projects: [{ id: 5, name: 'Neo-Tokyo' }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      await act(async () => {
        await result.current.fetchProjects({ search: 'Neo' });
      });
      expect(apiMock.get).toHaveBeenLastCalledWith(
        '/projects?page=1&search=Neo',
        expect.any(Object),
      );

      // Omitting search on the next call keeps the remembered term.
      apiMock.get.mockResolvedValueOnce({
        projects: [],
        pagination: { page: 2, pageSize: 12, total: 1, totalPages: 1 },
      });
      await act(async () => {
        await result.current.fetchProjects({ page: 2 });
      });
      expect(apiMock.get).toHaveBeenLastCalledWith(
        '/projects?page=2&search=Neo',
        expect.any(Object),
      );
    });
  });

  // The demo account is enforced read-only server-side (authenticateToken.js
  // rejects every mutating request before it reaches the database), but the UI
  // still needs to *feel* interactive: these mutations are simulated entirely
  // in local state. The single most important guarantee to prove here is that
  // none of them ever call the API — a network call would mean either a wasted
  // round trip to a 403, or (if this guard were ever removed) a real write.
  describe('demo account simulation', () => {
    beforeEach(() => {
      authState.user = { id: 44, isDemo: true };
    });

    afterEach(() => {
      // Restore the non-demo user so later top-level tests in this file aren't
      // affected by this describe block's mutation of the shared authState.
      authState.user = { id: 1 };
    });

    it('addProject prepends a locally-created project without calling the API', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      // Let the mount fetch (real GET, even for demo) settle first, so its
      // resolution doesn't race with — and clobber — addProject's sync-ish
      // local update below (it has no `await api.post` to yield behind).
      await act(async () => {});

      let returned;
      await act(async () => {
        returned = await result.current.addProject('Local Only');
      });

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(returned.name).toBe('Local Only');
      expect(returned.id).toBeLessThan(0);
      expect(result.current.projects[0]).toEqual(returned);
    });

    it('updateProjectPalette assigns local ids to new colors and keeps existing ones, without calling the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', palette: [{ id: 10, name: 'Ink', hex: '#112233' }] }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      let saved;
      await act(async () => {
        saved = await result.current.updateProjectPalette(3, [
          { id: 10, name: 'Ink', hex: '#112233' },
          { name: 'New Color', hex: '#abcdef' },
        ]);
      });

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe(10);
      expect(saved[1].id).toBeLessThan(0);
      expect(result.current.projects[0].palette).toEqual(saved);
    });

    it('deleteProject and restoreProject round-trip through local trash without calling the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', palette: [], brushNorms: [], typographyNorms: [] }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      let deleted;
      await act(async () => {
        deleted = await result.current.deleteProject(3);
      });
      expect(deleted).toBe(true);
      expect(apiMock.delete).not.toHaveBeenCalled();
      expect(result.current.projects).toEqual([]);
      expect(result.current.trashedProjects).toHaveLength(1);
      expect(result.current.trashedProjects[0]).toMatchObject({ id: 3, name: 'P', daysLeft: 30 });

      let restored;
      await act(async () => {
        restored = await result.current.restoreProject(3);
      });
      expect(restored).toBe(true);
      expect(apiMock.post).not.toHaveBeenCalled();
      expect(result.current.trashedProjects).toEqual([]);
      expect(result.current.projects[0]).toMatchObject({ id: 3, name: 'P' });
    });

    it('fetchTrashedProjects returns the local trash instead of hitting the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P' }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));
      apiMock.get.mockClear();

      await act(async () => {
        await result.current.deleteProject(3);
      });

      let fetched;
      await act(async () => {
        fetched = await result.current.fetchTrashedProjects();
      });

      expect(apiMock.get).not.toHaveBeenCalled();
      expect(fetched).toEqual(result.current.trashedProjects);
    });

    it('duplicateProject clones the source project with fresh local ids, without calling the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [
          {
            id: 3,
            name: 'Original',
            palette: [{ id: 10, name: 'Ink', hex: '#112233' }],
            brushNorms: [{ id: 20, name: 'Outline' }],
            typographyNorms: [{ id: 30, fontFamily: 'Figtree' }],
          },
        ],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      let copy;
      await act(async () => {
        copy = await result.current.duplicateProject(3);
      });

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(copy.name).toBe('Original (copy)');
      expect(copy.id).toBeLessThan(0);
      expect(copy.palette[0]).toMatchObject({ name: 'Ink', hex: '#112233' });
      expect(copy.palette[0].id).toBeLessThan(0);
      expect(copy.palette[0].id).not.toBe(copy.id);
      expect(result.current.projects[0]).toEqual(copy);
    });

    it('addBrushNorm appends a local norm and bumps normsCount, without calling the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', brushNorms: [], normsCount: 0 }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      let norm;
      await act(async () => {
        norm = await result.current.addBrushNorm(3, { name: 'Outline', value: '4' });
      });

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(norm.id).toBeLessThan(0);
      expect(result.current.projects[0].brushNorms).toEqual([norm]);
      expect(result.current.projects[0].normsCount).toBe(1);
    });

    it('pinProject, unpinProject and reorderPinnedProjects never call the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', pinned: false }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      await act(async () => {
        await result.current.pinProject(3);
      });
      expect(result.current.projects[0].pinned).toBe(true);

      await act(async () => {
        await result.current.unpinProject(3);
      });
      expect(result.current.projects[0].pinned).toBe(false);

      let reorderOk;
      await act(async () => {
        reorderOk = await result.current.reorderPinnedProjects([3]);
      });
      expect(reorderOk).toBe(true);

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(apiMock.delete).not.toHaveBeenCalled();
    });

    it('enableSharing reuses the seeded demo token without calling the API', async () => {
      apiMock.get.mockResolvedValue({
        projects: [{ id: 3, name: 'P', shareToken: null }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      });
      const { result } = renderHook(() => useProjects(), { wrapper });
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      let token;
      await act(async () => {
        token = await result.current.enableSharing(3);
      });

      expect(apiMock.post).not.toHaveBeenCalled();
      expect(token).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
      expect(result.current.projects[0].shareToken).toBe(token);
    });
  });
});

describe('ProjectContext deep-link resolution (fetch by id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 1 };
  });

  const emptyPage = {
    projects: [],
    pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
  };

  it('fetches a project beyond the loaded pages by id and merges it into the list', async () => {
    const deepProject = {
      id: 42,
      name: 'Deep Linked',
      lastEdited: '15/03 10:00',
      shareToken: null,
      pinned: false,
      brushNorms: [],
      typographyNorms: [],
      normsCount: 0,
      palette: [],
    };
    apiMock.get.mockImplementation((path) =>
      Promise.resolve(path === '/projects/42' ? deepProject : emptyPage),
    );

    const { result } = renderHook(() => useProjects(), { wrapper });
    await act(async () => {}); // mount fetch settles (page 1, without the project)

    act(() => {
      result.current.setActiveProjectId('42');
    });

    await waitFor(() => expect(result.current.activeProject?.id).toBe(42));
    expect(apiMock.get).toHaveBeenCalledWith('/projects/42');
    expect(result.current.activeProjectNotFound).toBe(false);
  });

  it('only reports not-found once the by-id lookup actually failed', async () => {
    const notFoundError = Object.assign(new Error('Project not found.'), { status: 404 });
    apiMock.get.mockImplementation((path) =>
      path === '/projects/99' ? Promise.reject(notFoundError) : Promise.resolve(emptyPage),
    );

    const { result } = renderHook(() => useProjects(), { wrapper });
    await act(async () => {});

    act(() => {
      result.current.setActiveProjectId('99');
    });

    await waitFor(() => expect(result.current.activeProjectNotFound).toBe(true));
    expect(result.current.activeProject).toBeNull();
    expect(result.current.projects).toEqual([]);
  });
});

describe('ProjectContext unfiltered total (dashboard stat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 1 };
  });

  it('keeps projectsTotalAll untouched by a filtered fetch', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        projects: [{ id: 1, name: 'Alpha' }],
        pagination: { page: 1, pageSize: 12, total: 20, totalPages: 2 },
      }) // mount fetch, unfiltered
      .mockResolvedValueOnce({
        projects: [{ id: 1, name: 'Alpha' }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      }); // filtered fetch

    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.projectsTotalAll).toBe(20));

    await act(async () => {
      await result.current.fetchProjects({ search: 'Alp' });
    });

    // The grid pagination follows the filter; the dashboard stat does not.
    expect(result.current.projectsPagination.total).toBe(1);
    expect(result.current.projectsTotalAll).toBe(20);
  });
});
