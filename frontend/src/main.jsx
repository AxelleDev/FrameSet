/**
 * Application entry point.
 *
 * Mounts the root <App /> component into the #root DOM node using the React 18
 * createRoot API. StrictMode is enabled to surface potential problems in
 * development (it intentionally double-invokes certain lifecycles/effects).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);