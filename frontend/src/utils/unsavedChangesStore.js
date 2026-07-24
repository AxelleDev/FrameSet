// Tiny module-level flag mirroring whatever page is currently mounted and has
// unsaved changes (see useUnsavedChangesWarning). Only one page renders at a
// time under the router, so this always reflects that page's latest state.
// Read synchronously by MainLayout's in-app nav links — beforeunload (the
// other half of the warning) only fires on a real document unload (tab
// close/reload/typed URL), never on client-side route changes, so in-app
// navigation needs this separate, synchronous check instead.
let hasUnsavedChanges = false;

export const getHasUnsavedChanges = () => hasUnsavedChanges;

export const setHasUnsavedChanges = (value) => {
  hasUnsavedChanges = value;
};
