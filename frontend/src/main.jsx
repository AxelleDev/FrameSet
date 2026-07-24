// Entry point: mount <App /> into #root. StrictMode surfaces dev-only problems.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initMonitoring } from './utils/monitoring';
import './index.css';

// No-op unless VITE_SENTRY_DSN is set (see utils/monitoring.js).
initMonitoring();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
