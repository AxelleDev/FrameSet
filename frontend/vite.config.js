import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  root: './',
  // Absolute base so hashed assets resolve from the site root on deep BrowserRouter
  // routes (e.g. /app/project/123/norms) after a hard reload or direct link.
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // New service-worker versions activate on the next visit without a prompt.
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'FrameSet — The graphic reference for your projects',
        short_name: 'FrameSet',
        description:
          "FrameSet keeps every project's graphic standards and color palette in one place.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F8F9FF',
        theme_color: '#8994DF',
        lang: 'en',
        categories: ['graphics', 'design', 'productivity'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // App shell only — the multi-MB brand PNGs are cached at runtime instead
        // (see runtimeCaching below) so first install stays light.
        globPatterns: ['**/*.{js,css,html,woff2}', 'pwa-192x192.png'],
        navigateFallback: '/index.html',
        // Never serve the SPA shell for API calls (proxied same-origin on Vercel).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Same-origin images (logos, icons) — hashed or stable, safe to keep.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Google Fonts stylesheets (typography previews) — revalidated in background.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-styles' },
          },
          {
            // Google Fonts font files — immutable, cache hard.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
      // lcov isn't in Vitest's default reporter set (text/html/clover/json) but
      // is the format Codecov's upload action expects.
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 80,
        lines: 82,
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
