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
});
