/**
 * Projects controller.
 *
 * Thin HTTP layer for projects and their nested style references: color
 * palettes, brush norms and typography norms. Each handler parses the request,
 * enforces authentication/ownership, delegates the business logic and SQL to
 * projects.service, and maps the result (or a typed service error) to the
 * appropriate status code and JSON body.
 */

const { getAuthenticatedUserId, createControllerLogger } = require('../utils/auth.utils');
const projectsService = require('../services/projects.service');

const logProjectsControllerError = createControllerLogger('projects');

/**
 * Authorization guard: confirms the authenticated user owns the given project
 * and writes the appropriate error response (401/403) when access should be
 * denied. Returns false when the caller must stop processing. Centralizing this
 * prevents IDOR (insecure direct object reference) where one user could read or
 * mutate another user's project by guessing its id.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {number|string} projectId Target project id.
 * @returns {Promise<boolean>} True if the user owns the project.
 */
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

/**
 * Lists all projects owned by the authenticated user, each enriched with its
 * brush norms, typography norms and palette.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const listProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  try {
    const fullProjects = await projectsService.listProjectsForUser(userId, req.id);
    res.json(fullProjects);
  } catch (error) {
    logProjectsControllerError(req, 'list', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Creates a new empty project for the authenticated user after validating the
 * project name length.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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
    res.json(newProject);
  } catch (error) {
    if (error.code === 'invalid_name') {
      return res.status(400).json({ error: 'Invalid project name.' });
    }
    logProjectsControllerError(req, 'create', error);
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Renames a project owned by the authenticated user and refreshes its
 * last_edited timestamp.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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

/**
 * Deletes a project owned by the authenticated user (cascading to its child
 * norms and palette via the schema's foreign keys).
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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

/**
 * Adds a brush norm to a project after ownership and payload validation.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const addBrushNorm = async (req, res) => {
  const { id } = req.params;
  const { name, value, unit, brushName, opacity } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    const result = await projectsService.addBrushNormToProject(id, { name, value, unit, brushName, opacity });
    res.json(result);
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'add_brush_norm', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Adds a typography norm to a project after ownership and payload validation.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const addTypographyNorm = async (req, res) => {
  const { id } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    const result = await projectsService.addTypographyNormToProject(id, { fontFamily, fontWeight, fontUsage, fontStyle });
    res.json(result);
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logProjectsControllerError(req, 'add_typography_norm', error, { projectId: id });
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Replaces a project's color palette with the provided ordered array of colors,
 * atomically. The payload is validated before any ownership check or database
 * work; the service then performs the transactional replace.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const updatePalette = async (req, res) => {
  const { id } = req.params;
  const colors = req.body;

  try {
    // Ownership is checked before validating the payload so an attacker cannot
    // probe another user's project through validation error messages.
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

/**
 * Deletes a brush norm from a project. The DELETE is scoped by both norm id and
 * project id (in addition to the ownership check).
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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
      normId
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Deletes a typography norm from a project, scoped by norm id and project id in
 * addition to the ownership check.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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
      normId
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Updates an existing brush norm after ownership and payload validation. The
 * UPDATE is scoped by norm id and project id, and last_edited is refreshed.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const updateBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { name, value, unit, brushName, opacity } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json(await projectsService.updateBrushNormInProject(projectId, normId, { name, value, unit, brushName, opacity }));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    logProjectsControllerError(req, 'update_brush_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

/**
 * Updates an existing typography norm after ownership and payload validation.
 * The UPDATE is scoped by norm id and project id, and last_edited is refreshed.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const updateTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    res.json(await projectsService.updateTypographyNormInProject(projectId, normId, { fontFamily, fontWeight, fontUsage, fontStyle }));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_found') {
      return res.status(404).json({ error: 'Standard not found.' });
    }
    logProjectsControllerError(req, 'update_typography_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Database error.' });
  }
};

module.exports = {
  listProjects,
  createProject,
  updateProjectName,
  deleteProject,
  addBrushNorm,
  addTypographyNorm,
  updatePalette,
  deleteBrushNorm,
  deleteTypographyNorm,
  updateBrushNorm,
  updateTypographyNorm
};
