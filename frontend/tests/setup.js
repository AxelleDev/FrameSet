// Fixed timezone so date-formatting tests (e.g. formatModified, which
// deliberately renders in the viewer's local timezone) are deterministic
// regardless of the machine/CI running them.
process.env.TZ = 'UTC';

import '@testing-library/jest-dom';

// fontfaceobserver's real implementation polls on a timer to detect when a
// font becomes usable — meaningless in jsdom (no real font rendering) and
// prone to firing after a test's jsdom environment has already been torn
// down, throwing "Cannot read properties of undefined (reading 'hidden')" as
// an unhandled error that fails the whole run even though every test passed.
// Typography-norm tests only care that a font is eventually marked loaded,
// not real browser font-loading fidelity, so replace it with an instant no-op.
vi.mock('fontfaceobserver', () => ({
  default: class FakeFontFaceObserver {
    load() {
      return Promise.resolve();
    }
  },
}));

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
