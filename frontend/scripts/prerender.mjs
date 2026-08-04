/**
 * Build-time prerendering of the public, auth-free routes: after the client
 * build, the SSR bundle (src/entry-server.jsx, built to dist-ssr/) renders
 * each route to HTML which is injected into dist/index.html's empty #root and
 * written as <route>/index.html. Vercel serves matching static files before
 * the SPA rewrite kicks in, so first paint no longer waits for React to boot
 * — the app then hydrates in place (see src/main.jsx).
 *
 * Only routes listed here may be prerendered, and their page components MUST
 * be imported eagerly in App.jsx (renderToString cannot await a lazy chunk).
 * Auth-gated routes (login/register) are deliberately absent: their guard
 * renders a loading state until the session probe settles, so their prerender
 * would be an empty spinner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = ['/', '/privacy', '/terms'];
const ROOT_MARKER = '<div id="root"></div>';

const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href);
const template = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
if (!template.includes(ROOT_MARKER)) {
  throw new Error('prerender: dist/index.html no longer contains an empty #root to inject into.');
}

// The EMPTY shell must keep existing for every non-prerendered route: the SPA
// fallback rewrite points at /app-shell.html (see vercel.json), because
// index.html itself becomes the prerendered landing below. Serving the
// landing's HTML to, say, /login would make hydration mismatch on purpose.
fs.writeFileSync(path.join(root, 'dist', 'app-shell.html'), template);

// Prerendered pages also get the WHOLE stylesheet inlined in place of the
// render-blocking <link>: first paint then needs nothing beyond the HTML
// itself. Inlining everything (not "critical CSS" extraction) is deliberate —
// every rule is present, so dark mode and every breakpoint render exactly
// right with zero flash; at ~40KB (a few KB gzipped) the weight is cheap.
// The shell keeps the plain <link>, so the rest of the app is untouched.
const linkMatch = template.match(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/);
if (!linkMatch) {
  throw new Error('prerender: could not find the stylesheet <link> in dist/index.html.');
}
const css = fs.readFileSync(path.join(root, 'dist', linkMatch[1].replace(/^\//, '')), 'utf8');
const inlineCss = (page) => page.replace(linkMatch[0], `<style>${css}</style>`);

for (const route of ROUTES) {
  const html = render(route);
  if (!html || html.length < 500) {
    throw new Error(`prerender: suspiciously small render for ${route} (${html.length} chars).`);
  }
  // The route is stamped on the container so main.jsx only hydrates when the
  // prerendered HTML actually belongs to the URL being served (a misrouted
  // fallback falls back to a clean client render instead of a mismatch).
  const page = inlineCss(
    template.replace(ROOT_MARKER, `<div id="root" data-prerendered="${route}">${html}</div>`),
  );
  const outFile =
    route === '/'
      ? path.join(root, 'dist', 'index.html')
      : path.join(root, 'dist', route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, page);
  console.log(
    `prerendered ${route} -> ${path.relative(root, outFile)} (${Math.round(page.length / 1024)}KB)`,
  );
}
