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

// Pinning: keeps a project at the top of the dashboard. Reorder is a
// user-level action (not scoped under a single project id), registered
// before '/:id/*' for the same "literal segment first" reason as '/trash'.
router.post('/pinned/reorder', authenticateToken, projectsController.reorderPinnedProjects);
router.post('/:id/pin', authenticateToken, projectsController.pinProject);
router.delete('/:id/pin', authenticateToken, projectsController.unpinProject);

// Public sharing: enable mints/returns the share token, disable revokes the link.
router.post('/:id/share', authenticateToken, projectsController.enableSharing);
router.delete('/:id/share', authenticateToken, projectsController.disableSharing);

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

// Reorder (drag-and-drop): same "send the full ordered id array" contract for
// both standard types, mirroring the palette's own position model.
router.post('/:id/brush-norms/reorder', authenticateToken, projectsController.reorderBrushNorms);
router.post(
  '/:id/typography-norms/reorder',
  authenticateToken,
  projectsController.reorderTypographyNorms,
);

// Individual color trash: the palette editor's "Delete" button uses this
// single-color endpoint (not the bulk replace above), so a deletion is always
// independently restorable. Registered before '/:id/palette' + ':colorId'
// routes that share the same prefix so nothing shadows anything else.
router.get('/:id/palette/trash', authenticateToken, projectsController.listTrashedPaletteColors);
router.delete('/:id/palette/:colorId', authenticateToken, projectsController.deletePaletteColor);
router.post(
  '/:id/palette/:colorId/restore',
  authenticateToken,
  projectsController.restorePaletteColor,
);
router.delete(
  '/:id/palette/:colorId/permanent',
  authenticateToken,
  projectsController.deletePaletteColorPermanently,
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

// Brush/typography norm trash: same restore/permanent-delete lifecycle as
// projects and palette colors.
router.get(
  '/:projectId/brush-norms/trash',
  authenticateToken,
  projectsController.listTrashedBrushNorms,
);
router.post(
  '/:projectId/brush-norms/:normId/restore',
  authenticateToken,
  projectsController.restoreBrushNorm,
);
router.delete(
  '/:projectId/brush-norms/:normId/permanent',
  authenticateToken,
  projectsController.deleteBrushNormPermanently,
);
router.get(
  '/:projectId/typography-norms/trash',
  authenticateToken,
  projectsController.listTrashedTypographyNorms,
);
router.post(
  '/:projectId/typography-norms/:normId/restore',
  authenticateToken,
  projectsController.restoreTypographyNorm,
);
router.delete(
  '/:projectId/typography-norms/:normId/permanent',
  authenticateToken,
  projectsController.deleteTypographyNormPermanently,
);

module.exports = router;
