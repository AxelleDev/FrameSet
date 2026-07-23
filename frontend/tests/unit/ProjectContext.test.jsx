import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
});
