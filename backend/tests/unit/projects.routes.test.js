const express = require('express');
const request = require('supertest');

const buildTestApp = () => {
  jest.resetModules();

  const controllerMocks = {
    listProjects: jest.fn((req, res) => res.status(200).json([])),
    createProject: jest.fn((req, res) => res.status(201).json({ success: true })),
    duplicateProject: jest.fn((req, res) => res.status(201).json({ success: true })),
    searchProjects: jest.fn((req, res) => res.status(200).json({ projects: [] })),
    listTrashedProjects: jest.fn((req, res) => res.status(200).json({ projects: [] })),
    restoreProject: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteProjectPermanently: jest.fn((req, res) => res.status(200).json({ success: true })),
    pinProject: jest.fn((req, res) => res.status(200).json({ success: true })),
    unpinProject: jest.fn((req, res) => res.status(200).json({ success: true })),
    reorderPinnedProjects: jest.fn((req, res) => res.status(200).json({ success: true })),
    enableSharing: jest.fn((req, res) => res.status(200).json({ shareToken: 'token' })),
    disableSharing: jest.fn((req, res) => res.status(200).json({ success: true })),
    getSharedProject: jest.fn((req, res) => res.status(200).json({ name: 'Shared' })),
    updateProjectName: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteProject: jest.fn((req, res) => res.status(200).json({ success: true })),
    addBrushNorm: jest.fn((req, res) => res.status(201).json({ success: true })),
    addTypographyNorm: jest.fn((req, res) => res.status(201).json({ success: true })),
    updatePalette: jest.fn((req, res) => res.status(201).json({ success: true })),
    reorderBrushNorms: jest.fn((req, res) => res.status(200).json({ success: true })),
    reorderTypographyNorms: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteBrushNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    listTrashedBrushNorms: jest.fn((req, res) => res.status(200).json({ norms: [] })),
    restoreBrushNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteBrushNormPermanently: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteTypographyNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    listTrashedTypographyNorms: jest.fn((req, res) => res.status(200).json({ norms: [] })),
    restoreTypographyNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    deleteTypographyNormPermanently: jest.fn((req, res) => res.status(200).json({ success: true })),
    deletePaletteColor: jest.fn((req, res) => res.status(200).json({ success: true })),
    listTrashedPaletteColors: jest.fn((req, res) => res.status(200).json({ colors: [] })),
    restorePaletteColor: jest.fn((req, res) => res.status(200).json({ success: true })),
    deletePaletteColorPermanently: jest.fn((req, res) => res.status(200).json({ success: true })),
    updateBrushNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
    updateTypographyNorm: jest.fn((req, res) => res.status(200).json({ success: true })),
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

describe('projects routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('returns 429 after 30 project creations for the same user', async () => {
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
      error: 'Too many project or standard creations, try again in an hour.',
    });
    expect(controllerMocks.createProject).toHaveBeenCalledTimes(30);
  });

  it('shares the quota between project and standard creations for the same user', async () => {
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
      .send({ name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth' });

    const otherUserResponse = await request(app)
      .post('/projects/1/brush-norms')
      .set('x-test-user-id', '8')
      .send({ name: 'Outline', value: '8', unit: 'px', brushName: 'Smooth' });

    expect(blockedNormResponse.status).toBe(429);
    expect(otherUserResponse.status).toBe(201);
    expect(controllerMocks.addBrushNorm).toHaveBeenCalledTimes(1);
  });
});
