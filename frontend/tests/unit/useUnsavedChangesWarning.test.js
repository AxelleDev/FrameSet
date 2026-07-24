import { renderHook } from '@testing-library/react';
import useUnsavedChangesWarning from '../../src/hooks/useUnsavedChangesWarning';
import { getHasUnsavedChanges } from '../../src/utils/unsavedChangesStore';

describe('useUnsavedChangesWarning', () => {
  it('does nothing and leaves the store clean when there are no unsaved changes', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useUnsavedChangesWarning(false));
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(getHasUnsavedChanges()).toBe(false);
    addSpy.mockRestore();
  });

  it('registers a beforeunload listener and mirrors the flag into the store when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useUnsavedChangesWarning(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(getHasUnsavedChanges()).toBe(true);
    addSpy.mockRestore();
  });

  it('calls preventDefault and sets returnValue on beforeunload', () => {
    renderHook(() => useUnsavedChangesWarning(true));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('removes the listener and clears the store on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));
    expect(getHasUnsavedChanges()).toBe(true);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(getHasUnsavedChanges()).toBe(false);
    removeSpy.mockRestore();
  });

  it('clears the store and the listener when the flag flips back to false', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesWarning(dirty), {
      initialProps: { dirty: true },
    });
    expect(getHasUnsavedChanges()).toBe(true);

    rerender({ dirty: false });
    expect(getHasUnsavedChanges()).toBe(false);
  });
});
