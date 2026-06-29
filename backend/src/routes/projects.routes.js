/**
 * Project routes.
 *
 * CRUD endpoints for projects and their nested resources (brush norms,
 * typography norms, color palette). Every route requires authentication, and
 * creation routes additionally pass through the project-create rate limiter.
 * Per-resource ownership is enforced inside the controllers.
 */

const express = require('express');
const projectsController = require('../controllers/projects.controller');
const authenticateToken = require('../middleware/authenticateToken');
const { projectCreateLimiter } = require('../middleware/projectCreateLimiter');

const router = express.Router();

router.get('/', authenticateToken, projectsController.listProjects);
router.post('/', authenticateToken, projectCreateLimiter, projectsController.createProject);
router.patch('/:id', authenticateToken, projectsController.updateProjectName);
router.delete('/:id', authenticateToken, projectsController.deleteProject);

router.post('/:id/brush-norms', authenticateToken, projectCreateLimiter, projectsController.addBrushNorm);
router.post('/:id/typography-norms', authenticateToken, projectCreateLimiter, projectsController.addTypographyNorm);
router.post('/:id/palette', authenticateToken, projectCreateLimiter, projectsController.updatePalette);

router.delete('/:projectId/brush-norms/:normId', authenticateToken, projectsController.deleteBrushNorm);
router.delete('/:projectId/typography-norms/:normId', authenticateToken, projectsController.deleteTypographyNorm);
router.delete('/:id/palette', authenticateToken, projectsController.deletePaletteColor);

router.patch('/:id/palette', authenticateToken, projectsController.updatePaletteColor);
router.put('/:projectId/brush-norms/:normId', authenticateToken, projectsController.updateBrushNorm);
router.put('/:projectId/typography-norms/:normId', authenticateToken, projectsController.updateTypographyNorm);

module.exports = router;
