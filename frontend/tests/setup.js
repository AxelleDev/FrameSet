// Fixed timezone so date-formatting tests (e.g. formatModified, which
// deliberately renders in the viewer's local timezone) are deterministic
// regardless of the machine/CI running them.
process.env.TZ = 'UTC';

import '@testing-library/jest-dom';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
