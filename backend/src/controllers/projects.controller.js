const { getAuthenticatedUserId, createControllerLogger } = require('../utils/auth.utils');
const projectsService = require('../services/projects.service');
const sharePreviewService = require('../services/sharePreview.service');
const shareEventsService = require('../services/shareEvents.service');

const logProjectsControllerError = createControllerLogger('projects');

// Authorization guard: confirm the user owns the project, else write 401/403 and return
// false. Prevents IDOR where a user could access another's project by guessing its id.
const ensureProjectOwnership = async (req, res, projectId) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated.' });
    return false;
  }

  if (!(await projectsService.userOwnsProject(userId, projectId))) {
    res.status(403).json({ error: 'Access to this project is forbidden.' });
    return false;
  }

  return true;
};

// List the user's projects, each enriched with its brush/typography norms and palette.
const listProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    // Invalid/missing pagination params fall back to the service defaults.
    const query = req.query || {};
    const parsedPage = Number.parseInt(query.page, 10);
    const parsedPageSize = Number.parseInt(query.pageSize, 10);
    const result = await projectsService.listProjectsForUser(userId, req.id, {
      page: Number.isNaN(parsedPage) ? undefined : parsedPage,
      pageSize: Number.isNaN(parsedPageSize) ? undefined : parsedPageSize,
      search: typeof query.search === 'string' ? query.search : undefined,
    });
    res.json(result);
  } catch (error) {
    logProjectsControllerError(req, 'list', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Fetch a single project (same shape as a listProjects item). Exists so a deep
// link / hard reload on a project beyond the loaded pages can resolve it; a
// project that is trashed, unknown or someone else's is a plain 404.
const getProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json(await projectsService.getProjectByIdForUser(userId, id));
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Project not found.' });
    }
    logProjectsControllerError(req, 'get', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Global search (Ctrl+K): one term matched across the user's project names,
// palette colors and standards. Scoping to the caller lives in the service.
const searchProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json(await projectsService.searchProjectContentForUser(userId, req.query?.q));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'search', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Create a new empty project for the authenticated user. Name validation
// (shape + 2-50 chars) lives in the service, shared with rename.
const createProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { name } = req.body;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    const newProject = await projectsService.createProjectForUser(userId, name);
    res.status(201).json(newProject);
  } catch (error) {
    if (error.code === 'missing_name') {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }
    if (error.code === 'invalid_name') {
      return res.status(400).json({ error: 'Invalid project name.' });
    }
    logProjectsControllerError(req, 'create', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Duplicate a project owned by the user: same norms and palette under a
// "<name> (copy)" title. Returns the full new project (201) for the dashboard.
const duplicateProject = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    const duplicated = await projectsService.duplicateProjectForUser(
      getAuthenticatedUserId(req),
      id,
    );
    res.status(201).json(duplicated);
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Project not found.' });
    }
    logProjectsControllerError(req, 'duplicate', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Pin a project to the top of the dashboard; idempotent.
const pinProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    if (!(await projectsService.pinProjectForUser(userId, id))) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'pin', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Unpin a project.
const unpinProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    if (!(await projectsService.unpinProjectForUser(userId, id))) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'unpin', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Reorder the user's pinned projects to match the given id array.
const reorderPinnedProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json(await projectsService.reorderPinnedProjectsForUser(userId, req.body));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'reorder_pinned', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Enable public sharing for an owned project; returns the (stable) share token.
const enableSharing = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.enableProjectSharing(id));
  } catch (error) {
    logProjectsControllerError(req, 'enable_sharing', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Disable public sharing: the link dies immediately.
const disableSharing = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.disableProjectSharing(id));
  } catch (error) {
    logProjectsControllerError(req, 'disable_sharing', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// PUBLIC (no auth): resolve a share token to its reference-sheet content. Any
// invalid, revoked or trashed link is a plain 404 with no detail.
const getSharedProject = async (req, res) => {
  try {
    res.json(await projectsService.getSharedProjectByToken(req.params.token));
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'This link is no longer active.' });
    }
    logProjectsControllerError(req, 'get_shared', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// PUBLIC (no auth): the social-preview PNG behind a share link's og:image.
// Same 404 contract as the JSON share read for unknown/revoked tokens.
const getSharedProjectPreview = async (req, res) => {
  try {
    const png = await sharePreviewService.getSharePreviewPngByToken(req.params.token);
    res.set('Content-Type', 'image/png');
    // Scrapers cache aggressively anyway; a short TTL keeps repeat unfurls
    // cheap without pinning a stale palette for long.
    res.set('Cache-Control', 'public, max-age=600');
    res.send(png);
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'This link is no longer active.' });
    }
    logProjectsControllerError(req, 'get_shared_preview', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// PUBLIC (no auth): the crawler-facing HTML for a share link. Social scrapers
// don't run the SPA's JavaScript, so Vercel rewrites their requests for
// /s/:token here; this page carries the Open Graph tags (including the
// preview image above) and bounces any human who lands on it back to the SPA.
const getSharedProjectEmbed = async (req, res) => {
  const escapeHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  try {
    const project = await projectsService.getSharedProjectByToken(req.params.token);
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    const pageUrl = `${frontendOrigin}/s/${encodeURIComponent(req.params.token)}`;
    const imageUrl = `${frontendOrigin}/api/share/${encodeURIComponent(req.params.token)}/preview.png`;
    const title = escapeHtml(`${project.name} — FrameSet`);
    const description = escapeHtml(
      `The graphic reference sheet for ${project.name}, by ${project.ownerName}. Colors, typography and brush specs in one place.`,
    );

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    // Keep the raw backend URL out of search indexes; the canonical below
    // points crawlers at the real SPA page instead.
    res.set('X-Robots-Tag', 'noindex');
    // Crawlers read the tags; the <meta refresh> sends everyone else to the SPA.
    res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FrameSet">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
</head>
<body>
<p><a href="${escapeHtml(pageUrl)}">View this reference sheet on FrameSet</a></p>
</body>
</html>`);
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'This link is no longer active.' });
    }
    logProjectsControllerError(req, 'get_shared_embed', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// PUBLIC (no auth): the live-update stream behind a shared page. Long-lived
// SSE response; subscribers get a bare `changed` ping whenever the owner
// mutates the project (see the notify middleware in projects.routes) and
// refetch the share endpoint themselves — no content ever flows through here.
const getSharedProjectEvents = async (req, res) => {
  let projectId;
  try {
    projectId = await projectsService.getSharedProjectIdByToken(req.params.token);
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'This link is no longer active.' });
    }
    logProjectsControllerError(req, 'get_shared_events', error);
    return res.status(500).json({ error: 'Server error.' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tells nginx-style proxies not to buffer the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  // EventSource reconnect delay after a drop (proxies do reap long requests).
  res.write('retry: 3000\n\n');

  if (!shareEventsService.subscribe(projectId, res)) {
    // Per-project cap reached: end politely, the page just isn't live.
    res.write('event: full\ndata: {}\n\n');
    return res.end();
  }

  req.on('close', () => shareEventsService.unsubscribe(projectId, res));
};

// Rename a project owned by the user and refresh its last_edited timestamp.
// Same name rule as creation, enforced by the shared service validator.
const updateProjectName = async (req, res) => {
  const { id } = req.params;
  let name;
  try {
    name = projectsService.validateProjectName(req.body?.name);
  } catch (error) {
    if (error.code === 'missing_name') {
      return res.status(400).json({ error: 'Project name is required.' });
    }
    return res.status(400).json({ error: 'Invalid project name.' });
  }
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.renameProject(id, name));
  } catch (error) {
    logProjectsControllerError(req, 'update_name', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Move a project to the trash (soft delete): restorable for 30 days via the
// trash endpoints, then dropped by the scheduled purge.
const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.deleteProjectById(id));
  } catch (error) {
    logProjectsControllerError(req, 'delete', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// List the user's trashed projects with the days left before their purge.
const listTrashedProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json({ projects: await projectsService.listTrashedProjectsForUser(userId) });
  } catch (error) {
    logProjectsControllerError(req, 'list_trash', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Restore a trashed project back to the dashboard.
const restoreProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json(await projectsService.restoreProjectForUser(userId, id));
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Project not found in the trash.' });
    }
    logProjectsControllerError(req, 'restore', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Permanently delete a TRASHED project (children cascade); irreversible.
const deleteProjectPermanently = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    res.json(await projectsService.deleteProjectPermanently(userId, id));
  } catch (error) {
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Project not found in the trash.' });
    }
    logProjectsControllerError(req, 'delete_permanently', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Add a brush norm to a project after ownership and payload validation.
const addBrushNorm = async (req, res) => {
  const { id } = req.params;
  const { name, value, unit, brushName, opacity } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    const result = await projectsService.addBrushNormToProject(id, {
      name,
      value,
      unit,
      brushName,
      opacity,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'add_brush_norm', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Add a typography norm to a project after ownership and payload validation.
const addTypographyNorm = async (req, res) => {
  const { id } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    const result = await projectsService.addTypographyNormToProject(id, {
      fontFamily,
      fontWeight,
      fontUsage,
      fontStyle,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'add_typography_norm', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Atomically replace a project's color palette with the provided ordered array.
const updatePalette = async (req, res) => {
  const { id } = req.params;
  const colors = req.body;

  try {
    // Check ownership before validating so an attacker can't probe another user's
    // project through validation error messages.
    if (!(await ensureProjectOwnership(req, res, id))) return;

    let validatedColors;
    try {
      validatedColors = projectsService.validatePalettePayload(colors);
    } catch (error) {
      if (error.code === 'validation') {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }

    const result = await projectsService.replaceProjectPalette(id, validatedColors);
    res.json(result);
  } catch (error) {
    logProjectsControllerError(req, 'update_palette', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Reorder a project's brush standards to match the given id array (drag-and-drop).
const reorderBrushNorms = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.reorderBrushNormsForProject(id, req.body));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'reorder_brush_norms', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Reorder a project's typography standards to match the given id array (drag-and-drop).
const reorderTypographyNorms = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json(await projectsService.reorderTypographyNormsForProject(id, req.body));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'reorder_typography_norms', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Move a brush norm to the trash (soft delete), scoped by norm id and project
// id on top of the ownership check. Restorable for 30 days via the trash endpoints.
const deleteBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.deleteBrushNormFromProject(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_brush_norm', error, {
      projectId,
      normId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Move a typography norm to the trash (soft delete), scoped by norm id and
// project id on top of the ownership check.
const deleteTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.deleteTypographyNormFromProject(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_typography_norm', error, {
      projectId,
      normId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

// List a project's trashed brush norms with the days left before their purge.
const listTrashedBrushNorms = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json({ norms: await projectsService.listTrashedBrushNormsForProject(projectId) });
  } catch (error) {
    logProjectsControllerError(req, 'list_trashed_brush_norms', error, { projectId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Restore a trashed brush norm.
const restoreBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.restoreBrushNormInProject(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'restore_brush_norm', error, { projectId, normId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Permanently delete a TRASHED brush norm; irreversible.
const deleteBrushNormPermanently = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.deleteBrushNormPermanently(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_brush_norm_permanently', error, { projectId, normId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// List a project's trashed typography norms with the days left before their purge.
const listTrashedTypographyNorms = async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json({ norms: await projectsService.listTrashedTypographyNormsForProject(projectId) });
  } catch (error) {
    logProjectsControllerError(req, 'list_trashed_typography_norms', error, { projectId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Restore a trashed typography norm.
const restoreTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.restoreTypographyNormInProject(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'restore_typography_norm', error, { projectId, normId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Permanently delete a TRASHED typography norm; irreversible.
const deleteTypographyNormPermanently = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    if (!(await projectsService.deleteTypographyNormPermanently(projectId, normId))) {
      return res.status(404).json({ error: 'Standard not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_typography_norm_permanently', error, {
      projectId,
      normId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Move a single palette color to the trash (soft delete), scoped by color id
// and project id. Distinct from updatePalette (bulk replace): this is the
// path the palette editor's "Delete" button uses, so an individual color
// deletion is always independently restorable.
const deletePaletteColor = async (req, res) => {
  const { id, colorId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    if (!(await projectsService.deletePaletteColorFromProject(id, colorId))) {
      return res.status(404).json({ error: 'Color not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_palette_color', error, { projectId: id, colorId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// List a project's trashed palette colors with the days left before their purge.
const listTrashedPaletteColors = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    res.json({ colors: await projectsService.listTrashedPaletteColorsForProject(id) });
  } catch (error) {
    logProjectsControllerError(req, 'list_trashed_palette_colors', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Restore a trashed palette color.
const restorePaletteColor = async (req, res) => {
  const { id, colorId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    if (!(await projectsService.restorePaletteColorInProject(id, colorId))) {
      return res.status(404).json({ error: 'Color not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'restore_palette_color', error, { projectId: id, colorId });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Permanently delete a TRASHED palette color; irreversible.
const deletePaletteColorPermanently = async (req, res) => {
  const { id, colorId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    if (!(await projectsService.deletePaletteColorPermanently(id, colorId))) {
      return res.status(404).json({ error: 'Color not found in the trash.' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_palette_color_permanently', error, {
      projectId: id,
      colorId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Update a brush norm (scoped by norm id and project id) and refresh last_edited.
const updateBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { name, value, unit, brushName, opacity } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json(
      await projectsService.updateBrushNormInProject(projectId, normId, {
        name,
        value,
        unit,
        brushName,
        opacity,
      }),
    );
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    logProjectsControllerError(req, 'update_brush_norm', error, {
      projectId,
      normId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

// Update a typography norm (scoped by norm id and project id) and refresh last_edited.
const updateTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json(
      await projectsService.updateTypographyNormInProject(projectId, normId, {
        fontFamily,
        fontWeight,
        fontUsage,
        fontStyle,
      }),
    );
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    logProjectsControllerError(req, 'update_typography_norm', error, {
      projectId,
      normId,
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

module.exports = {
  listProjects,
  getProject,
  searchProjects,
  createProject,
  duplicateProject,
  updateProjectName,
  deleteProject,
  listTrashedProjects,
  restoreProject,
  deleteProjectPermanently,
  pinProject,
  unpinProject,
  reorderPinnedProjects,
  enableSharing,
  disableSharing,
  getSharedProject,
  getSharedProjectPreview,
  getSharedProjectEmbed,
  getSharedProjectEvents,
  addBrushNorm,
  addTypographyNorm,
  updatePalette,
  reorderBrushNorms,
  reorderTypographyNorms,
  deleteBrushNorm,
  listTrashedBrushNorms,
  restoreBrushNorm,
  deleteBrushNormPermanently,
  deleteTypographyNorm,
  listTrashedTypographyNorms,
  restoreTypographyNorm,
  deleteTypographyNormPermanently,
  deletePaletteColor,
  listTrashedPaletteColors,
  restorePaletteColor,
  deletePaletteColorPermanently,
  updateBrushNorm,
  updateTypographyNorm,
};
