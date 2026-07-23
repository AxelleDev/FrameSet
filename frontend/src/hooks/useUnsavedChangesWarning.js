import { useEffect } from 'react';
import { setHasUnsavedChanges } from '../utils/unsavedChangesStore';

// Warns before the tab closes, reloads, or the user types a new URL while
// `hasUnsavedChanges` is true (e.g. a form field was edited but not yet
// saved) — the native beforeunload prompt, browser-rendered text. Also mirrors
// the flag into unsavedChangesStore so in-app navigation (sidebar links, which
// never trigger beforeunload since the document never unloads for those) can
// ask for confirmation too; see MainLayout.
export default function useUnsavedChangesWarning(hasUnsavedChanges) {
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
