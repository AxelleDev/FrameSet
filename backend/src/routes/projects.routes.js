const express = require('express');
const projectsController = require('../controllers/projects.controller');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.get('/', authenticateToken, projectsController.listProjects);
router.post('/', authenticateToken, projectsController.createProject);
router.patch('/:id', authenticateToken, projectsController.updateProjectName);
router.put('/:id', authenticateToken, projectsController.updateProjectName);
router.delete('/:id', authenticateToken, projectsController.deleteProject);

router.post('/:id/brush-norms', authenticateToken, projectsController.addBrushNorm);
router.post('/:id/typography-norms', authenticateToken, projectsController.addTypographyNorm);
router.post('/:id/palette', authenticateToken, projectsController.updatePalette);

router.delete('/:projectId/brush-norms/:normId', authenticateToken, projectsController.deleteBrushNorm);
router.delete('/:projectId/typography-norms/:normId', authenticateToken, projectsController.deleteTypographyNorm);
router.delete('/:id/palette', authenticateToken, projectsController.deletePaletteColor);

router.patch('/:id/palette', authenticateToken, projectsController.updatePaletteColor);
router.put('/:projectId/brush-norms/:normId', authenticateToken, projectsController.updateBrushNorm);
router.put('/:projectId/typography-norms/:normId', authenticateToken, projectsController.updateTypographyNorm);

module.exports = router;
