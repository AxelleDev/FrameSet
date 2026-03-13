const db = require('../database');
const validator = require('validator');
const { getAuthenticatedUserId } = require('../utils/auth.utils');
const { logger } = require('../utils/logger');

const logProjectsControllerError = (req, operation, error, meta = {}) => {
  const userId = getAuthenticatedUserId(req);
  const logMeta = {
    requestId: req.id,
    ...meta,
    error
  };

  if (userId) {
    logMeta.userId = userId;
  }

  logger.error(`projects.${operation}.error`, logMeta);
};

const ensureProjectOwnership = async (req, res, projectId) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Utilisateur non authentifié.' });
    return false;
  }

  const [rows] = await db.query(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?',
    [projectId, userId]
  );

  if (rows.length === 0) {
    res.status(403).json({ error: 'Accès interdit à ce projet.' });
    return false;
  }

  return true;
};

const MAX_PALETTE_SIZE = 50;

const sanitizeOptionalTextField = (value, { maxLength }) => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return { error: 'invalid_type' };
  }

  const trimmedValue = validator.trim(String(value));
  if (!trimmedValue) {
    return { value: null };
  }

  if (!validator.isLength(trimmedValue, { max: maxLength })) {
    return { error: 'invalid_length' };
  }

  return { value: trimmedValue };
};

const validateBrushNormPayload = ({ name, value, unit, brushName }) => {
  if (typeof name !== 'string') {
    return { error: 'Le nom de la norme de trait est invalide.' };
  }

  const trimmedName = validator.trim(name);
  if (!validator.isLength(trimmedName, { min: 1, max: 255 })) {
    return { error: 'Le nom de la norme de trait est invalide.' };
  }

  const valueAsString = typeof value === 'number' ? String(value) : value;
  if (typeof valueAsString !== 'string') {
    return { error: 'La valeur de la norme de trait doit etre un nombre positif.' };
  }

  const trimmedValue = validator.trim(valueAsString);
  if (!validator.isFloat(trimmedValue, { gt: 0, max: 1000 })) {
    return { error: 'La valeur de la norme de trait doit etre un nombre positif.' };
  }

  const unitInput = unit === undefined || unit === null ? 'px' : unit;
  if (typeof unitInput !== 'string') {
    return { error: "L'unite de la norme de trait est invalide." };
  }

  const trimmedUnit = validator.trim(unitInput);
  if (!validator.isLength(trimmedUnit, { min: 1, max: 20 }) || !validator.matches(trimmedUnit, /^[a-zA-Z%]+$/)) {
    return { error: "L'unite de la norme de trait est invalide." };
  }

  const normalizedBrushName = sanitizeOptionalTextField(brushName, { maxLength: 255 });
  if (normalizedBrushName.error) {
    return { error: 'Le nom du pinceau est invalide.' };
  }

  return {
    value: {
      name: trimmedName,
      value: trimmedValue,
      unit: trimmedUnit,
      brushName: normalizedBrushName.value
    }
  };
};

const validateTypographyNormPayload = ({ fontFamily, fontWeight, fontUsage, fontStyle }) => {
  if (typeof fontFamily !== 'string') {
    return { error: 'La famille de police est invalide.' };
  }

  const trimmedFontFamily = validator.trim(fontFamily);
  if (!validator.isLength(trimmedFontFamily, { min: 1, max: 255 })) {
    return { error: 'La famille de police est invalide.' };
  }

  const normalizedFontWeight = sanitizeOptionalTextField(fontWeight, { maxLength: 100 });
  if (normalizedFontWeight.error) {
    return { error: 'Le poids de police est invalide.' };
  }

  const normalizedFontUsage = sanitizeOptionalTextField(fontUsage, { maxLength: 255 });
  if (normalizedFontUsage.error) {
    return { error: "L'usage typographique est invalide." };
  }

  const normalizedFontStyle = sanitizeOptionalTextField(fontStyle, { maxLength: 100 });
  if (normalizedFontStyle.error) {
    return { error: 'Le style de police est invalide.' };
  }

  return {
    value: {
      fontFamily: trimmedFontFamily,
      fontWeight: normalizedFontWeight.value,
      fontUsage: normalizedFontUsage.value,
      fontStyle: normalizedFontStyle.value
    }
  };
};

const listProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  try {
    const [projectsData] = await db.query(
      'SELECT *, DATE_FORMAT(last_edited, "%d/%m %H:%i") as lastEditedFormatted FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    const fullProjects = await Promise.all(projectsData.map(async (p) => {
      const [brushNorms] = await db.query('SELECT * FROM project_brush_norms WHERE project_id = ?', [p.id]);
      const [typographyNorms] = await db.query('SELECT * FROM project_typography_norms WHERE project_id = ?', [p.id]);
      const [palette] = await db.query('SELECT * FROM project_palette WHERE project_id = ?', [p.id]);
      return {
        id: p.id,
        name: p.name,
        lastEdited: p.lastEditedFormatted || 'À l\'instant',
        brushNorms: brushNorms.map(n => ({
          id: n.id,
          name: n.name,
          value: n.value,
          unit: n.unit,
          brushName: n.brush_name
        })),
        typographyNorms: typographyNorms.map(n => ({
          id: n.id,
          fontFamily: n.font_family,
          fontWeight: n.font_weight,
          fontUsage: n.font_usage,
          fontStyle: n.font_style
        })),
        normsCount: brushNorms.length + typographyNorms.length,
        palette: palette.map(c => ({
          name: c.name,
          hex: c.hex
        }))
      };
    }));
    res.json(fullProjects);
  } catch (error) {
    logProjectsControllerError(req, 'list', error);
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const createProject = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  let { name } = req.body;
  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  name = validator.trim(name);
  if (!validator.isLength(name, { min: 2, max: 50 })) {
    return res.status(400).json({ error: 'Nom de projet invalide.' });
    }
  try {
    const [result] = await db.query(
      'INSERT INTO projects (user_id, name, progress) VALUES (?, ?, 0)',
      [userId, name]
    );
    const newId = result.insertId;

    const newProject = {
      id: newId,
      name,
      lastEdited: 'À l\'instant',
      normsCount: 0,
      norms: [],
      palette: []
    };
    res.json(newProject);
  } catch (error) {
    logProjectsControllerError(req, 'create', error);
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const updateProjectName = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom du projet requis.' });
  }
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    await db.query('UPDATE projects SET name = ?, last_edited = NOW() WHERE id = ?', [name.trim(), id]);
    res.json({ success: true, name: name.trim() });
  } catch (error) {
    logProjectsControllerError(req, 'update_name', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    await db.query('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const addBrushNorm = async (req, res) => {
  const { id } = req.params;
  const { name, value, unit, brushName } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;

    const validatedBrushNorm = validateBrushNormPayload({ name, value, unit, brushName });
    if (validatedBrushNorm.error) {
      return res.status(400).json({ error: validatedBrushNorm.error });
    }

    const [result] = await db.query(
      'INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        validatedBrushNorm.value.name,
        validatedBrushNorm.value.value,
        validatedBrushNorm.value.unit,
        validatedBrushNorm.value.brushName
      ]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    logProjectsControllerError(req, 'add_brush_norm', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const addTypographyNorm = async (req, res) => {
  const { id } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;

    const validatedTypographyNorm = validateTypographyNormPayload({ fontFamily, fontWeight, fontUsage, fontStyle });
    if (validatedTypographyNorm.error) {
      return res.status(400).json({ error: validatedTypographyNorm.error });
    }

    const [result] = await db.query(
      'INSERT INTO project_typography_norms (project_id, font_family, font_weight, font_usage, font_style) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        validatedTypographyNorm.value.fontFamily,
        validatedTypographyNorm.value.fontWeight,
        validatedTypographyNorm.value.fontUsage,
        validatedTypographyNorm.value.fontStyle
      ]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    logProjectsControllerError(req, 'add_typography_norm', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const updatePalette = async (req, res) => {
  const { id } = req.params;
  const colors = req.body;

  if (!Array.isArray(colors)) {
    return res.status(400).json({ error: 'La palette doit être un tableau de couleurs.' });
  }
  if (colors.length > MAX_PALETTE_SIZE) {
    return res.status(400).json({ error: `La palette ne peut pas dépasser ${MAX_PALETTE_SIZE} couleurs.` });
  }

  for (const color of colors) {
    if (typeof color?.hex !== 'string' || !validator.isHexColor(color.hex)) {
      return res.status(400).json({ error: `Couleur invalide : la valeur hex "${color?.hex}" n'est pas un format valide (#RGB ou #RRGGBB).` });
    }
    const nameCheck = sanitizeOptionalTextField(color.name, { maxLength: 255 });
    if (nameCheck.error) {
      return res.status(400).json({ error: 'Le nom de la couleur est invalide.' });
    }
  }

  const connection = await db.getConnection();
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;

    await connection.beginTransaction();

    for (const color of colors) {
      const safeName = sanitizeOptionalTextField(color.name, { maxLength: 255 }).value;
      await connection.query(
        'REPLACE INTO project_palette (project_id, name, hex) VALUES (?, ?, ?)',
        [id, safeName, color.hex]
      );
    }
    await connection.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    logProjectsControllerError(req, 'update_palette', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  } finally {
    connection.release();
  }
};

const deleteBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    const [result] = await db.query('DELETE FROM project_brush_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_brush_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const deleteTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;
    const [result] = await db.query('DELETE FROM project_typography_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_typography_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const deletePaletteColor = async (req, res) => {
  const { id } = req.params;
  const { hex } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    await db.query('DELETE FROM project_palette WHERE project_id = ? AND hex = ?', [id, hex]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete_palette_color', error, {
      projectId: id
    });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const updatePaletteColor = async (req, res) => {
  const { id } = req.params;
  const { oldHex, newName, newHex } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;
    await db.query(
      'UPDATE project_palette SET name = ?, hex = ? WHERE project_id = ? AND hex = ?',
      [newName, newHex, id, oldHex]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'update_palette_color', error, {
      projectId: id
    });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const updateBrushNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { name, value, unit, brushName } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;

    const validatedBrushNorm = validateBrushNormPayload({ name, value, unit, brushName });
    if (validatedBrushNorm.error) {
      return res.status(400).json({ error: validatedBrushNorm.error });
    }

    const [result] = await db.query(
      'UPDATE project_brush_norms SET name = ?, value = ?, unit = ?, brush_name = ? WHERE id = ? AND project_id = ?',
      [
        validatedBrushNorm.value.name,
        validatedBrushNorm.value.value,
        validatedBrushNorm.value.unit,
        validatedBrushNorm.value.brushName,
        normId,
        projectId
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'update_brush_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

const updateTypographyNorm = async (req, res) => {
  const { projectId, normId } = req.params;
  const { fontFamily, fontWeight, fontUsage, fontStyle } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, projectId))) return;

    const validatedTypographyNorm = validateTypographyNormPayload({ fontFamily, fontWeight, fontUsage, fontStyle });
    if (validatedTypographyNorm.error) {
      return res.status(400).json({ error: validatedTypographyNorm.error });
    }

    const [result] = await db.query(
      'UPDATE project_typography_norms SET font_family = ?, font_weight = ?, font_usage = ?, font_style = ? WHERE id = ? AND project_id = ?',
      [
        validatedTypographyNorm.value.fontFamily,
        validatedTypographyNorm.value.fontWeight,
        validatedTypographyNorm.value.fontUsage,
        validatedTypographyNorm.value.fontStyle,
        normId,
        projectId
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Norme non trouvée' });
    }
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'update_typography_norm', error, {
      projectId,
      normId
    });
    res.status(500).json({ error: 'Erreur base de données' });
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
  deletePaletteColor,
  updatePaletteColor,
  updateBrushNorm,
  updateTypographyNorm
};
