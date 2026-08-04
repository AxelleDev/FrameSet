/**
 * Guards the OpenAPI spec against drift: every documented method+path must
 * exist as a mounted Express route, and every mounted API route must be
 * documented. The spec is hand-written (src/docs/openapi.js), so nothing else
 * would catch a route added without documentation — or documentation left
 * behind for a removed route.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.TOTP_ENCRYPTION_KEY =
  process.env.TOTP_ENCRYPTION_KEY ||
  '20f766230f5b4740f5b620d2dde09488b110435c13395edb10e1fdcd5ddf2098';

const app = require('../../src/app');
const openapiSpec = require('../../src/docs/openapi');

// Reconstructs a router's mount path from the regexp Express 4 stores for it
// (e.g. /^\/api\/auth\/?(?=\/|$)/i -> "/api/auth").
const pathFromRegexp = (regexp) => {
  if (regexp.fast_slash) return '';
  return regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
};

// Walks the app/router layer stack and returns every "METHOD /path" mounted.
const collectRoutes = (stack, prefix = '') => {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      routes.push(...collectRoutes(layer.handle.stack, prefix + pathFromRegexp(layer.regexp)));
    }
  }
  return routes;
};

// Express ":param" -> OpenAPI "{param}", plus trailing-slash normalization
// (a router's "/" route mounts as e.g. "/api/projects/").
const normalizeRoutePath = (route) => {
  const [method, rawPath] = route.split(' ');
  const path = rawPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/$/, '') || '/';
  return `${method} ${path}`;
};

describe('OpenAPI spec stays in sync with the mounted routes', () => {
  it('documents exactly the API surface the app exposes', () => {
    const mounted = collectRoutes(app._router.stack)
      .map(normalizeRoutePath)
      // The comparison covers the documented surface: /health and /api/*.
      // Swagger's own endpoints (/api-docs*) and the E2E-only /api/_test
      // routes (not mounted here) are intentionally undocumented. /api/v1/*
      // is a mount-level ALIAS of the same routers (see app.js): its surface
      // is identical by construction, so it is documented once via the spec's
      // servers list rather than duplicating every path entry.
      .filter(
        (route) =>
          / \/health$/.test(route) ||
          (/ \/api\//.test(route) &&
            !/ \/api-docs/.test(route) &&
            !/ \/api\/_test/.test(route) &&
            !/ \/api\/v1\//.test(route)),
      );

    const documented = Object.entries(openapiSpec.paths).flatMap(([specPath, operations]) =>
      Object.keys(operations)
        .filter((key) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(key))
        .map((method) => `${method.toUpperCase()} ${specPath}`),
    );

    const mountedSet = [...new Set(mounted)].sort();
    const documentedSet = [...new Set(documented)].sort();

    const undocumented = mountedSet.filter((route) => !documentedSet.includes(route));
    const stale = documentedSet.filter((route) => !mountedSet.includes(route));

    expect({ undocumentedRoutes: undocumented, staleSpecEntries: stale }).toEqual({
      undocumentedRoutes: [],
      staleSpecEntries: [],
    });
  });
});
