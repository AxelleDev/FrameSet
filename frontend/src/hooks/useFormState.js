import { useState, useCallback, useRef } from 'react';

// Controlled-form state: { values, setValues, setField(key, val), reset() }.
export const useFormState = (initial = {}) => {
  const [values, setValues] = useState(initial);
  // Capture the very first `initial` so `reset` stays stable even when callers
  // pass an inline object literal (a new identity on every render).
  const initialRef = useRef(initial);
  const setField = useCallback((key, val) => setValues((v) => ({ ...v, [key]: val })), []);
  const reset = useCallback(() => setValues(initialRef.current), []);
  return { values, setValues, setField, reset };
};

export default useFormState;
