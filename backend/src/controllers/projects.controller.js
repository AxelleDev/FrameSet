/**
 * Projects controller: thin HTTP layer for projects and their nested style refs
 * (palettes, brush/typography norms). Business logic and SQL live in projects.service.
 */

const { getAuthenticatedUserId, createControllerLogger } = require('../utils/auth.utils');
const projectsService = require('../services/projects.service');

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
    });
    res.json(result);
  } catch (error) {
    logProjectsControllerError(req, 'list', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

// Create a new empty project for the authenticated user.
const createProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { name } = req.body;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Required fields are missing.' });
  }
  try {
    const newProject = await projectsService.createProjectForUser(userId, name);
    res.status(201).json(newProject);
  } catch (error) {
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

// Rename a project owned by the user and refresh its last_edited timestamp.
const updateProjectName = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
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

// Delete a brush norm, scoped by norm id and project id on top of the ownership check.
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

// Delete a typography norm, scoped by norm id and project id on top of the ownership check.
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
  createProject,
  duplicateProject,
  updateProjectName,
  deleteProject,
  listTrashedProjects,
  restoreProject,
  deleteProjectPermanently,
  enableSharing,
  disableSharing,
  getSharedProject,
  addBrushNorm,
  addTypographyNorm,
  updatePalette,
  deleteBrushNorm,
  deleteTypographyNorm,
  updateBrushNorm,
  updateTypographyNorm,
};
