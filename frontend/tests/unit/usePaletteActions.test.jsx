// The palette lifecycle hook: bulk replace adopting the server's canonical
// palette, demo-simulated replace, and the trash/restore/permanent-delete
// paths with their error handling.
import { renderHook, act } from '@testing-library/react';
import usePaletteActions from '../../src/hooks/usePaletteActions';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../src/services/api', () => ({ default: apiMock }));

const baseProject = (over = {}) => ({
  id: 1,
  name: 'P',
  palette: [{ id: 10, name: 'Ink', hex: '#112233' }],
  ...over,
});

const setup = ({ isDemo = false, projects = [baseProject()] } = {}) => {
  const state = { projects, trashed: [] };
  const setProjects = vi.fn((updater) => {
    state.projects = typeof updater === 'function' ? updater(state.projects) : updater;
  });
  const setTrashedPaletteColors = vi.fn((updater) => {
    state.trashed = typeof updater === 'function' ? updater(state.trashed) : updater;
  });
  const setGlobalError = vi.fn();
  let demoId = 0;
  const { result } = renderHook(() =>
    usePaletteActions({
      isDemo,
      projects: state.projects,
      setProjects,
      setGlobalError,
      nextDemoId: () => --demoId,
      trashedPaletteColors: state.trashed,
      setTrashedPaletteColors,
      trashedPaletteColorsRef: { current: state.trashed },
    }),
  );
  return { result, state, setGlobalError };
};

describe('usePaletteActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk-saves the palette and adopts the canonical server response', async () => {
    apiMock.post.mockResolvedValueOnce({
      palette: [{ id: 20, name: 'Blush', hex: '#FCBFC4' }],
    });
    const { result, state } = setup();

    let saved;
    await act(async () => {
      saved = await result.current.updateProjectPalette(1, [{ name: 'Blush', hex: '#FCBFC4' }]);
    });

    expect(saved).toEqual([{ id: 20, name: 'Blush', hex: '#FCBFC4' }]);
    expect(state.projects[0].palette).toEqual(saved);
  });

  it('in demo mode, assigns negative ids locally and never calls the API', async () => {
    const { result, state } = setup({ isDemo: true });

    let saved;
    await act(async () => {
      saved = await result.current.updateProjectPalette(1, [
        { id: 10, name: 'Ink', hex: '#112233' },
        { name: 'New', hex: '#AB6C69' },
      ]);
    });

    expect(apiMock.post).not.toHaveBeenCalled();
    expect(saved[0].id).toBe(10); // existing id kept
    expect(saved[1].id).toBeLessThan(0); // new color simulated
    expect(state.projects[0].palette).toHaveLength(2);
  });

  it('surfaces a save failure in the banner and returns null, leaving state intact', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('quota'));
    const { result, state, setGlobalError } = setup();

    let saved;
    await act(async () => {
      saved = await result.current.updateProjectPalette(1, []);
    });

    expect(saved).toBeNull();
    expect(setGlobalError).toHaveBeenCalledWith('quota');
    expect(state.projects[0].palette).toHaveLength(1);
  });

  it('trashes a single color and refreshes the trash silently', async () => {
    apiMock.delete.mockResolvedValueOnce({ success: true });
    apiMock.get.mockResolvedValueOnce({ colors: [{ id: 10, daysLeft: 30 }] });
    const { result, state } = setup();

    let ok;
    await act(async () => {
      ok = await result.current.deleteColor(1, 10);
    });

    expect(ok).toBe(true);
    expect(state.projects[0].palette).toHaveLength(0);
  });

  it('in demo mode, trashing a color feeds the simulated local trash', async () => {
    const { result, state } = setup({ isDemo: true });

    await act(async () => {
      await result.current.deleteColor(1, 10);
    });

    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(state.projects[0].palette).toHaveLength(0);
    expect(state.trashed[0]).toEqual(expect.objectContaining({ id: 10 }));
  });

  it('restores a trashed color through the restore endpoint', async () => {
    apiMock.post.mockResolvedValueOnce({ success: true });
    apiMock.get.mockResolvedValueOnce({ colors: [] });
    const { result, state } = setup({ projects: [baseProject({ palette: [] })] });
    state.trashed = [{ id: 10, name: 'Ink', hex: '#112233', daysLeft: 8 }];

    await act(async () => {
      await result.current.restoreColor(1, 10);
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1/palette/10/restore'),
      expect.anything(),
      expect.any(Object),
    );
  });

  it('permanently deletes a trashed color and reports failures cleanly', async () => {
    apiMock.delete.mockResolvedValueOnce({ success: true });
    const { result } = setup();
    await act(async () => {
      await result.current.deleteColorPermanently(1, 10);
    });
    expect(apiMock.delete).toHaveBeenCalledWith(
      expect.stringContaining('/projects/1/palette/10/permanent'),
      null,
      expect.any(Object),
    );

    apiMock.delete.mockRejectedValueOnce(new Error('gone wrong'));
    let ok;
    await act(async () => {
      ok = await result.current.deleteColorPermanently(1, 10);
    });
    expect(ok).toBe(false);
  });
});
