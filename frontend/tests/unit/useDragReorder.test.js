import { renderHook, act } from '@testing-library/react';
import useDragReorder from '../../src/hooks/useDragReorder';

const items = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
];

describe('useDragReorder', () => {
  it('mirrors the external items into items/previewItems', () => {
    const { result } = renderHook(() => useDragReorder({ items, onPersist: vi.fn() }));
    expect(result.current.items).toEqual(items);
    expect(result.current.previewItems).toEqual(items);
  });

  it('moveItem persists the optimistic order when onPersist returns true', async () => {
    const onPersist = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    await act(async () => {
      await result.current.moveItem(0, 2);
    });

    expect(onPersist).toHaveBeenCalledWith([
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
    ]);
    expect(result.current.items.map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('moveItem adopts the canonical array when onPersist returns one', async () => {
    const saved = [
      { id: 2, name: 'B (saved)' },
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
    ];
    const onPersist = vi.fn().mockResolvedValue(saved);
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    await act(async () => {
      await result.current.moveItem(0, 2);
    });

    expect(result.current.items).toEqual(saved);
  });

  it('moveItem rolls back to the previous order when onPersist fails', async () => {
    const onPersist = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    await act(async () => {
      await result.current.moveItem(0, 2);
    });

    expect(result.current.items).toEqual(items);
    expect(result.current.previewItems).toEqual(items);
  });

  it('moveItem does nothing when the target index is out of range', async () => {
    const onPersist = vi.fn();
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    await act(async () => {
      await result.current.moveItem(0, -1);
      await result.current.moveItem(0, 99);
    });

    expect(onPersist).not.toHaveBeenCalled();
    expect(result.current.items).toEqual(items);
  });

  it('replaceItems persists a full replacement and adopts the saved array', async () => {
    const next = [...items, { id: 4, name: 'D' }];
    const onPersist = vi.fn().mockResolvedValue(next);
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    let saved;
    await act(async () => {
      saved = await result.current.replaceItems(next);
    });

    expect(saved).toEqual(next);
    expect(result.current.items).toEqual(next);
  });

  it('drag-and-drop from index 0 to 2 reorders and persists after the drop delay', async () => {
    vi.useFakeTimers();
    const onPersist = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    act(() => {
      const handlers = result.current.getDragHandlers(items[0], 0);
      handlers.onDragStart({ dataTransfer: {} });
    });
    act(() => {
      const handlers = result.current.getDragHandlers(items[2], 2);
      handlers.onDragOver({ preventDefault: () => {} });
    });
    act(() => {
      const handlers = result.current.getDragHandlers(items[2], 2);
      handlers.onDrop({ preventDefault: () => {} });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(onPersist).toHaveBeenCalledWith([
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
    ]);
    expect(result.current.items.map((i) => i.id)).toEqual([2, 3, 1]);

    vi.useRealTimers();
  });

  it('reverts the preview on a cancelled drag (onDragEnd without a drop)', () => {
    const onPersist = vi.fn();
    const { result } = renderHook(() => useDragReorder({ items, onPersist }));

    act(() => {
      result.current.getDragHandlers(items[0], 0).onDragStart({ dataTransfer: {} });
    });
    act(() => {
      result.current.getDragHandlers(items[2], 2).onDragOver({ preventDefault: () => {} });
    });
    act(() => {
      result.current.getDragHandlers(items[0], 0).onDragEnd();
    });

    expect(onPersist).not.toHaveBeenCalled();
    expect(result.current.previewItems).toEqual(items);
    expect(result.current.draggedId).toBeNull();
  });
});
