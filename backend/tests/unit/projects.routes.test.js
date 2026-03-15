const express = require('express');
const request = require('supertest');

const buildTestApp = () => {
  jest.resetModules();

  const controllerMocks = {
    listProjects: jest.fn((req, res) => res.status(200).json([])),
    createProject: jest.fn((req, res) => res.status(201).json({ success: true })),
    updateProjectName: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteProject: jest.fn((req, res) => res.status(200).json({ success: true })),
    addBrushNorm: jest.fn((req, res) => res.status(201).json({ success: true })),
    addTypographyNorm: jest.fn((req, res) => res.status(201).json({ success: true })),
    updatePalette: jest.fn((req, res) => res.status(201).json({ success: true })),
    deleteBrushNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteTypographyNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    deletePaletteColor: jest.fn((req, res) => res.status(200).json({ success: true })),
    updatePaletteColor: jest.fn((req, res) => res.status(200).json({ success: true })),
    updateBrushNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    updateTypographyNorm: jest.fn((req, res) => res.status(200).json({ success: true }))
  };

  jest.doMock('../../src/controllers/projects.controller', () => controllerMocks);
  jest.doMock('../../src/middleware/authenticateToken', () => (req, res, next) => {
    req.user = { id: Number(req.get('x-test-user-id') || 1) };
    next();
  });

  const projectsRoutes = require('../../src/routes/projects.routes');
  const app = express();
  app.use(express.json());
  app.use('/projects', projectsRoutes);

  return { app, controllerMocks };
};

describe('routes projets', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('retourne 429 apres 30 creations de projet pour le meme utilisateur', async () => {
    const { app, controllerMocks } = buildTestApp();

    for (let index = 0; index < 30; index += 1) {
      const response = await request(app)
        .post('/projects')
        .set('x-test-user-id', '42')
        .send({ name: `Project ${index + 1}` });

      expect(response.status).toBe(201);
    }

    const overflowResponse = await request(app)
      .post('/projects')
      .set('x-test-user-id', '42')
      .send({ name: 'Project 31' });

    expect(overflowResponse.status).toBe(429);
    expect(overflowResponse.body).toEqual({
      error: 'Trop de creations de projets ou de normes, reessayez dans une heure.'
    });
    expect(controllerMocks.createProject).toHaveBeenCalledTimes(30);
  });

  it('partage le quota entre les creations de projet et de normes pour un meme utilisateur', async () => {
    const { app, controllerMocks } = buildTestApp();

    for (let index = 0; index < 30; index += 1) {
      const response = await request(app)
        .post('/projects')
        .set('x-test-user-id', '7')
        .send({ name: `Project ${index + 1}` });

      expect(response.status).toBe(201);
    }

    const blockedNormResponse = await request(app)
      .post('/projects/1/brush-norms')
      .set('x-test-user-id', '7')
      .send({ name: 'Contour', value: '8', unit: 'px', brushName: 'Smooth' });

    const otherUserResponse = await request(app)
      .post('/projects/1/brush-norms')
      .set('x-test-user-id', '8')
      .send({ name: 'Contour', value: '8', unit: 'px', brushName: 'Smooth' });

    expect(blockedNormResponse.status).toBe(429);
    expect(otherUserResponse.status).toBe(201);
    expect(controllerMocks.addBrushNorm).toHaveBeenCalledTimes(1);
  });
});