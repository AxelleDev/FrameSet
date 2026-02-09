const express = require('express');
const projectsController = require('../controllers/projects.controller');

const router = express.Router();

router.get('/', projectsController.listProjects);
router.post('/', projectsController.createProject);
router.patch('/:id', projectsController.updateProjectName);
router.put('/:id', projectsController.updateProjectName);
router.delete('/:id', projectsController.deleteProject);

router.post('/:id/brush-norms', projectsController.addBrushNorm);
router.post('/:id/typography-norms', projectsController.addTypographyNorm);
router.post('/:id/palette', projectsController.updatePalette);

router.delete('/:projectId/brush-norms/:normId', projectsController.deleteBrushNorm);
router.delete('/:projectId/typography-norms/:normId', projectsController.deleteTypographyNorm);
router.delete('/:id/palette', projectsController.deletePaletteColor);

router.patch('/:id/palette', projectsController.updatePaletteColor);
router.put('/:projectId/brush-norms/:normId', projectsController.updateBrushNorm);
router.put('/:projectId/typography-norms/:normId', projectsController.updateTypographyNorm);

module.exports = router;
