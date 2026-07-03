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
