/**
 * Build-time prerender entry (see scripts/prerender.mjs): renders a public
 * route to an HTML string with the exact same providers + route tree as the
 * browser entry, StaticRouter standing in for BrowserRouter. Only routes
 * whose page components are imported eagerly in App.jsx can be rendered here
 * (renderToString cannot await a lazy chunk).
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppProviders, AppRouteTree } from './App';

export function render(url) {
  return renderToString(
    <AppProviders>
      <StaticRouter location={url}>
        <AppRouteTree />
      </StaticRouter>
    </AppProviders>,
  );
}
