// Entry point: mount <App /> into #root. StrictMode surfaces dev-only problems.
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initMonitoring } from './utils/monitoring';
import './index.css';

// No-op unless VITE_SENTRY_DSN is set (see utils/monitoring.js).
initMonitoring();

// PWA service worker (production builds only — a no-op module in dev). New
// versions download in the background and take over on the next visit.
registerSW({ immediate: true });

const container = document.getElementById('root');
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Public routes are prerendered at build time (scripts/prerender.mjs): when
// #root carries the server HTML FOR THIS URL, hydrate it in place. Any other
// case — empty shell, or a misconfigured fallback serving a prerendered page
// for the wrong route — mounts from a clean container instead, so hydration
// can never mismatch on purpose.
const prerenderedRoute = container.dataset.prerendered;
const currentRoute = window.location.pathname.replace(/\/+$/, '') || '/';
if (container.hasChildNodes() && prerenderedRoute === currentRoute) {
  hydrateRoot(container, app);
} else {
  if (container.hasChildNodes()) container.replaceChildren();
  createRoot(container).render(app);
}
