import { useState, useCallback } from 'react';

/**
 * Small reusable hook for managing controlled-form state.
 *
 * @param {object} [initial] Initial field values.
 * @returns {{
 *   values: object,                         // current field values
 *   setValues: Function,                    // replace the whole values object
 *   setField: (key: string, val: *) => void,// update a single field
 *   reset: () => void                       // restore the initial values
 * }}
 */
export const useFormState = (initial = {}) => {
  const [values, setValues] = useState(initial);
  const setField = useCallback((key, val) => setValues(v => ({ ...v, [key]: val })), []);
  const reset = useCallback(() => setValues(initial), [initial]);
  return { values, setValues, setField, reset };
};

export default useFormState;
