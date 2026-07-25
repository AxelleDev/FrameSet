import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  root: './',
  // Absolute base so hashed assets resolve from the site root on deep BrowserRouter
  // routes (e.g. /app/project/123/norms) after a hard reload or direct link.
  base: '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    css: true,
    include: ['tests/**/*.{test,spec}.{js,jsx}'],
    // Coverage ratchet, enforced only when run with --coverage (CI does): the
    // thresholds sit just below today's measured levels so they block a
    // coverage regression without failing on normal variance. Raise them as
    // coverage grows — never lower them.
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 71,
        branches: 59,
        functions: 70,
        lines: 73,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
