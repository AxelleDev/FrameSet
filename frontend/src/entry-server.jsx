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
