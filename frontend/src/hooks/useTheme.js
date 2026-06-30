import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'frameset-theme';

/**
 * Resolves the initial theme: a previously saved choice wins, otherwise we
 * follow the OS preference. Kept in sync with the no-flash script in index.html.
 * @returns {'light'|'dark'}
 */
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

/**
 * Light/dark theme hook. Applies the `dark` class on <html> and persists the
 * choice. Theme state survives navigation via localStorage, so a single toggle
 * mounted at a time (sidebar or auth screen) stays consistent.
 *
 * @returns {{ theme: 'light'|'dark', toggleTheme: () => void }}
 */
export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
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
