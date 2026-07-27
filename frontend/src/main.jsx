// Entry point: mount <App /> into #root. StrictMode surfaces dev-only problems.
import React from 'react';
import { createRoot } from 'react-dom/client';
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
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
