// The shared CRUD engine behind brush AND typography standards: server paths
// (optimistic state patch from the API response), demo-simulated paths (local
// state only, negative ids), and the error paths that must roll into the
// global error banner instead of throwing.
import { renderHook, act } from '@testing-library/react';
import useNormActions from '../../src/hooks/useNormActions';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../src/services/api', () => ({ default: apiMock }));

const baseProject = (over = {}) => ({
  id: 1,
  name: 'P',
  brushNorms: [{ id: 10, name: 'Line', value: '8' }],
  normsCount: 1,
  ...over,
});

const setup = ({ isDemo = false, projects = [baseProject()] } = {}) => {
  let state = { projects, trashed: [] };
  const setProjects = vi.fn((updater) => {
    state.projects = typeof updater === 'function' ? updater(state.projects) : updater;
  });
  const setTrashedItems = vi.fn((updater) => {
    state.trashed = typeof updater === 'function' ? updater(state.trashed) : updater;
  });
  const setGlobalError = vi.fn();
  let demoId = 0;
  const { result } = renderHook(() =>
    useNormActions({
      kind: 'BrushNorm',
      fieldName: 'brushNorms',
      apiSegment: 'brush-norms',
      isDemo,
      projects: state.projects,
      setProjects,
      setGlobalError,
      nextDemoId: () => --demoId,
      trashedItems: state.trashed,
      setTrashedItems,
      trashedItemsRef: { current: state.trashed },
    }),
  );
  return { result, state, setGlobalError };
};

describe('useNormActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a norm with the server-assigned id and bumps normsCount', async () => {
    apiMock.post.mockResolvedValueOnce({ id: 42 });
    const { result, state } = setup();

    let returned;
    await act(async () => {
      returned = await result.current.addNorm(1, { name: 'Shade', value: '4' });
    });

    expect(returned).toEqual({ id: 42, name: 'Shade', value: '4' });
    expect(apiMock.post).toHaveBeenCalledWith(
      '/projects/1/brush-norms',
      { name: 'Shade', value: '4' },
      expect.any(Object),
    );
    expect(state.projects[0].brushNorms).toHaveLength(2);
    expect(state.projects[0].normsCount).toBe(2);
  });

  it('in demo mode, adds locally with a negative id and never calls the API', async () => {
    const { result, state } = setup({ isDemo: true });

    let returned;
    await act(async () => {
      returned = await result.current.addNorm(1, { name: 'Shade', value: '4' });
    });

    expect(returned.id).toBeLessThan(0);
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(state.projects[0].brushNorms).toHaveLength(2);
  });

  it('surfaces an add failure in the global banner and returns null', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('boom'));
    const { result, state, setGlobalError } = setup();

    let returned;
    await act(async () => {
      returned = await result.current.addNorm(1, { name: 'Shade', value: '4' });
    });

    expect(returned).toBeNull();
    expect(setGlobalError).toHaveBeenCalledWith('boom');
    expect(state.projects[0].brushNorms).toHaveLength(1); // untouched
  });

  it('trashes a norm server-side, removes it locally and refreshes the trash silently', async () => {
    apiMock.delete.mockResolvedValueOnce({ success: true });
    apiMock.get.mockResolvedValueOnce({ norms: [{ id: 10, daysLeft: 30 }] });
    const { result, state } = setup();

    let ok;
    await act(async () => {
      ok = await result.current.deleteNorm(1, 10);
    });

    expect(ok).toBe(true);
    expect(state.projects[0].brushNorms).toHaveLength(0);
    expect(state.projects[0].normsCount).toBe(0);
    expect(apiMock.get).toHaveBeenCalledWith('/projects/1/brush-norms/trash', undefined);
  });

  it('in demo mode, trashing moves the norm to a simulated local trash', async () => {
    const { result, state } = setup({ isDemo: true });

    await act(async () => {
      await result.current.deleteNorm(1, 10);
    });

    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(state.projects[0].brushNorms).toHaveLength(0);
    expect(state.trashed[0]).toEqual(expect.objectContaining({ id: 10, daysLeft: 30 }));
  });

  it('reports a delete failure and keeps the norm in place', async () => {
    apiMock.delete.mockRejectedValueOnce(new Error('down'));
    const { result, state, setGlobalError } = setup();

    let ok;
    await act(async () => {
      ok = await result.current.deleteNorm(1, 10);
    });

    expect(ok).toBe(false);
    expect(setGlobalError).toHaveBeenCalledWith('down');
    expect(state.projects[0].brushNorms).toHaveLength(1);
  });

  it('updates a norm in place from the server response', async () => {
    apiMock.put.mockResolvedValueOnce({ success: true });
    const { result, state } = setup();

    let ok;
    await act(async () => {
      ok = await result.current.updateNorm(1, 10, { name: 'Line thick', value: '12' });
    });

    expect(ok).toBe(true);
    expect(state.projects[0].brushNorms[0]).toEqual(
      expect.objectContaining({ id: 10, name: 'Line thick', value: '12' }),
    );
  });

  it('restores a trashed norm back into the list', async () => {
    apiMock.post.mockResolvedValueOnce({ success: true });
    apiMock.get.mockResolvedValueOnce({ norms: [] });
    const { result, state } = setup({
      projects: [baseProject({ brushNorms: [], normsCount: 0 })],
    });
    state.trashed = [{ id: 10, name: 'Line', value: '8', daysLeft: 12 }];

    await act(async () => {
      await result.current.restoreNorm(1, 10);
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      '/projects/1/brush-norms/10/restore',
      {},
      expect.any(Object),
    );
  });

  it('reorders norms optimistically and calls the reorder endpoint', async () => {
    apiMock.post.mockResolvedValueOnce({ success: true });
    const { result } = setup({
      projects: [
        baseProject({
          brushNorms: [
            { id: 10, name: 'A' },
            { id: 11, name: 'B' },
          ],
        }),
      ],
    });

    await act(async () => {
      await result.current.reorderNorms(1, [11, 10]);
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      '/projects/1/brush-norms/reorder',
      [11, 10],
      expect.any(Object),
    );
  });
});
