import React from 'react';
import { createRoot } from 'react-dom/client';
// On pointe explicitement vers le nouveau dossier frontend
import App from './frontend/src/App.jsx';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// AI Studio always uses an `index.tsx` file for all project types.
