import { renderHook, act } from '@testing-library/react';
import useFormState from '../../src/hooks/useFormState';

describe('useFormState', () => {
  it('initializes with the provided values', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));
    expect(result.current.values).toEqual({ name: '', email: '' });
  });

  it('updates a single field with setField', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));
    act(() => result.current.setField('name', 'Jane'));
    expect(result.current.values).toEqual({ name: 'Jane', email: '' });
  });

  it('replaces everything with setValues', () => {
    const { result } = renderHook(() => useFormState({ a: 1 }));
    act(() => result.current.setValues({ a: 5, b: 6 }));
    expect(result.current.values).toEqual({ a: 5, b: 6 });
  });

  it('resets with reset', () => {
    const { result } = renderHook(() => useFormState({ a: 1 }));
    act(() => result.current.setField('a', 99));
    act(() => result.current.reset());
    expect(result.current.values).toEqual({ a: 1 });
  });
});
