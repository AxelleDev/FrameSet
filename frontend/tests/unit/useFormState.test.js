import { renderHook, act } from '@testing-library/react';
import useFormState from '../../src/hooks/useFormState';

describe('useFormState', () => {
  it('initialise avec les valeurs fournies', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));
    expect(result.current.values).toEqual({ name: '', email: '' });
  });

  it('met à jour un seul champ avec setField', () => {
    const { result } = renderHook(() => useFormState({ name: '', email: '' }));
    act(() => result.current.setField('name', 'Prénom'));
    expect(result.current.values).toEqual({ name: 'Prénom', email: '' });
  });

  it('remplace tout avec setValues', () => {
    const { result } = renderHook(() => useFormState({ a: 1 }));
    act(() => result.current.setValues({ a: 5, b: 6 }));
    expect(result.current.values).toEqual({ a: 5, b: 6 });
  });

  it('réinitialise avec reset', () => {
    const { result } = renderHook(() => useFormState({ a: 1 }));
    act(() => result.current.setField('a', 99));
    act(() => result.current.reset());
    expect(result.current.values).toEqual({ a: 1 });
  });
});
