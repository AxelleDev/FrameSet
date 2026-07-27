import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'frameset-theme';

// Resolves the initial theme: a saved choice wins, else the OS preference.
// Kept in sync with the no-flash script in index.html.
function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* localStorage may be unavailable (private mode) — fall through */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// Light/dark theme: toggles the `dark` class on <html> and persists to
// localStorage, so separate toggles (sidebar, auth screen) stay consistent.
export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Keep the browser/PWA title bar on theme: brand periwinkle in light, the
    // dark canvas (--color-canvas in index.css) in dark. Same values live in
    // index.html and theme-init.js.
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#16171E' : '#8994DF');
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence errors */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
