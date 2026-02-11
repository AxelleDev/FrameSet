import { useState, useCallback } from 'react';

// Petit hook réutilisable pour gérer l'état d'un formulaire.
// Fournit `values`, `setValues`, `setField` (mise à jour d'un champ) et `reset`.
export const useFormState = (initial = {}) => {
  const [values, setValues] = useState(initial);
  const setField = useCallback((key, val) => setValues(v => ({ ...v, [key]: val })), []);
  const reset = useCallback(() => setValues(initial), [initial]);
  return { values, setValues, setField, reset };
};

export default useFormState;
