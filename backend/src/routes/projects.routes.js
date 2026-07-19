/**
 * Project routes: CRUD for projects and their nested resources (brush/typography
 * norms, palette). All require auth; creation routes also pass the create limiter.
 * Per-resource ownership is enforced in the controllers.
 */

const express = require('express');
const projectsController = require('../controllers/projects.controller');
const authenticateToken = require('../middleware/authenticateToken');
const { projectCreateLimiter } = require('../middleware/projectCreateLimiter');

const router = express.Router();

router.get('/', authenticateToken, projectsController.listProjects);
router.post('/', authenticateToken, projectCreateLimiter, projectsController.createProject);
// Duplication creates a project too, so it shares the creation rate limit.
router.post(
  '/:id/duplicate',
  authenticateToken,
  projectCreateLimiter,
  projectsController.duplicateProject,
);
// Trash: soft-deleted projects, restorable for 30 days before the purge.
// Registered before the '/:id' routes so 'trash' is never read as a project id.
router.get('/trash', authenticateToken, projectsController.listTrashedProjects);
router.post('/:id/restore', authenticateToken, projectsController.restoreProject);
router.delete('/:id/permanent', authenticateToken, projectsController.deleteProjectPermanently);

router.patch('/:id', authenticateToken, projectsController.updateProjectName);
router.delete('/:id', authenticateToken, projectsController.deleteProject);

router.post(
  '/:id/brush-norms',
  authenticateToken,
  projectCreateLimiter,
  projectsController.addBrushNorm,
);
router.post(
  '/:id/typography-norms',
  authenticateToken,
  projectCreateLimiter,
  projectsController.addTypographyNorm,
);
router.post(
  '/:id/palette',
  authenticateToken,
  projectCreateLimiter,
  projectsController.updatePalette,
);

router.delete(
  '/:projectId/brush-norms/:normId',
  authenticateToken,
  projectsController.deleteBrushNorm,
);
router.delete(
  '/:projectId/typography-norms/:normId',
  authenticateToken,
  projectsController.deleteTypographyNorm,
);

router.put(
  '/:projectId/brush-norms/:normId',
  authenticateToken,
  projectsController.updateBrushNorm,
);
router.put(
  '/:projectId/typography-norms/:normId',
  authenticateToken,
  projectsController.updateTypographyNorm,
);

module.exports = router;
