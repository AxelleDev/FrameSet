/**
 * Projects controller.
 *
 * CRUD for projects and their nested style references: color palettes, brush
 * norms and typography norms. Every mutating handler first asserts that the
 * authenticated user owns the target project (ensureProjectOwnership), and all
 * user-supplied fields are validated/sanitized before reaching the database.
 * The list endpoint deliberately batches child queries to avoid an N+1 pattern.
 */

const db = require('../database');
const validator = require('validator');
const { getAuthenticatedUserId, createControllerLogger } = require('../utils/auth.utils');
const { logger } = require('../utils/logger');

const logProjectsControllerError = createControllerLogger('projects');

/**
 * Authorization guard: confirms the authenticated user owns the given project.
 * Centralizing this check prevents IDOR (insecure direct object reference) where
 * one user could read or mutate another user's project by guessing its id.
 * Writes the appropriate error response (401/403) and returns false when access
 * should be denied; the caller must stop processing on a false result.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 * @param {number|string} projectId Target project id.
 * @returns {Promise<boolean>} True if the user owns the project.
 */
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

// Upper bound on palette size to cap per-request work and storage.
const MAX_PALETTE_SIZE = 50;

/**
 * Normalizes an optional text field: accepts null/undefined as "no value",
 * coerces numbers/strings, trims, and enforces a maximum length. Returns either
 * { value } or { error } so callers can branch without throwing.
 * @param {*} value Raw input value.
 * @param {{maxLength:number}} options
 * @returns {{value: string|null}|{error: string}}
 */
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

/** Builds the standard user-facing error message for an invalid hex color. */
const buildInvalidHexColorError = (value) => (
  `Couleur invalide : la valeur hex "${value}" n'est pas un format valide (#RGB ou #RRGGBB).`
);

/**
 * Validates a hex color string, requiring a leading '#' and a valid #RGB/#RRGGBB
 * form. Returns the trimmed value or an error marker.
 * @param {*} value Candidate color.
 * @returns {{value:string}|{error:string}}
 */
const validateHexColorField = (value) => {
  if (typeof value !== 'string') {
    return { error: 'invalid_hex' };
  }

  const trimmedValue = validator.trim(value);
  if (!trimmedValue.startsWith('#') || !validator.isHexColor(trimmedValue)) {
    return { error: 'invalid_hex' };
  }

  return { value: trimmedValue };
};

/**
 * Validates and normalizes a brush norm payload: required name, a positive
 * numeric value (capped), a unit restricted to letters/percent, an optional
 * brush name, and an optional opacity in the 0-1 range. Returns the normalized
 * fields or the first error encountered.
 * @param {{name:*, value:*, unit:*, brushName:*, opacity:*}} payload
 * @returns {{value:Object}|{error:string}}
 */
const validateBrushNormPayload = ({ name, value, unit, brushName, opacity }) => {
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

  let validatedOpacity = null;
  if (opacity !== undefined) {
    if (typeof opacity === 'string' || typeof opacity === 'number') {
      const opStr = String(opacity).trim();
      if (validator.isFloat(opStr, { min: 0, max: 1 })) {
        validatedOpacity = parseFloat(opStr);
      } else {
        return { error: "L'opacité doit être un nombre entre 0 et 1." };
      }
    } else {
      return { error: "L'opacité doit être un nombre entre 0 et 1." };
    }
  }
  return {
    value: {
      name: trimmedName,
      value: trimmedValue,
      unit: trimmedUnit,
      brushName: normalizedBrushName.value,
      opacity: validatedOpacity
    }
  };
};

/**
 * Validates and normalizes a typography norm payload: required font family plus
 * optional weight, usage and style fields (each length-bounded).
 * @param {{fontFamily:*, fontWeight:*, fontUsage:*, fontStyle:*}} payload
 * @returns {{value:Object}|{error:string}}
 */
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

/**
 * Runs a SQL query while measuring its wall-clock duration, returning the rows
 * alongside timing metadata. Used to instrument the list endpoint's queries for
 * performance logging.
 * @param {{label:string, sql:string, params:Array}} options
 * @returns {Promise<{rows:Array, timing:{label:string, durationMs:number, rowCount:number}}>}
 */
const runTimedQuery = async ({ label, sql, params }) => {
  const startedAt = process.hrtime.bigint();
  const [rows] = await db.query(sql, params);
  const durationMs = Number((Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(2));

  return {
    rows,
    timing: {
      label,
      durationMs,
      rowCount: Array.isArray(rows) ? rows.length : 0
    }
  };
};

/**
 * Buckets child rows by their project_id, applying a mapper to each row. This
 * lets the list endpoint fetch all children in one query and then assemble them
 * per project in memory, avoiding a separate query per project (N+1).
 * @param {Array} rows Child rows carrying a project_id.
 * @param {(row:Object)=>Object} mapper Transforms a row into its output shape.
 * @returns {Map<number, Object[]>}
 */
const groupRowsByProjectId = (rows, mapper) => {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const projectId = Number(row.project_id);

    if (!Number.isInteger(projectId)) {
      return;
    }

    if (!groupedRows.has(projectId)) {
      groupedRows.set(projectId, []);
    }

    groupedRows.get(projectId).push(mapper(row));
  });

  return groupedRows;
};

/**
 * Emits a performance log for the list endpoint, contrasting the number of
 * queries actually issued against the count a naive N+1 implementation would
 * have used (1 projects query + 3 per project), to make the optimization's
 * benefit observable in production metrics.
 * @param {{req:Object, userId:number, projectCount:number, queryTimings:Array}} params
 */
const logListProjectsPerformance = ({ req, userId, projectCount, queryTimings }) => {
  // Baseline query count a per-project (N+1) approach would have incurred.
  const legacyNPlusOneQueryCount = 1 + (projectCount * 3);
  const optimizedSqlQueries = queryTimings.length;
  const queryReduction = legacyNPlusOneQueryCount - optimizedSqlQueries;
  const queryReductionPercent = legacyNPlusOneQueryCount === 0
    ? 0
    : Number(((queryReduction / legacyNPlusOneQueryCount) * 100).toFixed(2));
  const totalSqlTimeMs = Number(
    queryTimings.reduce((accumulator, queryTiming) => accumulator + queryTiming.durationMs, 0).toFixed(2)
  );

  logger.info('projects.list.performance', {
    requestId: req.id,
    userId,
    projectCount,
    legacyNPlusOneQueryCount,
    optimizedSqlQueries,
    queryReduction,
    queryReductionPercent,
    totalSqlTimeMs,
    sqlTimings: queryTimings
  });
};

/**
 * Lists all projects owned by the authenticated user, each enriched with its
 * brush norms, typography norms and palette. Children are fetched with three
 * batched IN-list queries (run in parallel) and grouped in memory, avoiding the
 * N+1 query pattern that fetching children per project would cause.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const listProjects = async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }
  try {
    const queryTimings = [];

    const projectsQuery = await runTimedQuery({
      label: 'projects',
      sql: 'SELECT *, DATE_FORMAT(last_edited, "%d/%m %H:%i") as lastEditedFormatted FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      params: [userId]
    });

    queryTimings.push(projectsQuery.timing);

    const projectsData = projectsQuery.rows;
    if (projectsData.length === 0) {
      logListProjectsPerformance({
        req,
        userId,
        projectCount: 0,
        queryTimings
      });

      return res.json([]);
    }

    const projectIds = projectsData.map((project) => Number(project.id));
    // Build parameterized placeholders for an IN (...) clause; values are bound
    // as query parameters to keep the query injection-safe.
    const placeholders = projectIds.map(() => '?').join(', ');

    // Fetch all children for all projects in three parallel batched queries.
    const [brushNormsQuery, typographyNormsQuery, paletteQuery] = await Promise.all([
      runTimedQuery({
        label: 'project_brush_norms',
        sql: `SELECT id, project_id, name, value, unit, brush_name, opacity FROM project_brush_norms WHERE project_id IN (${placeholders})`,
        params: projectIds
      }),
      runTimedQuery({
        label: 'project_typography_norms',
        sql: `SELECT id, project_id, font_family, font_weight, font_usage, font_style FROM project_typography_norms WHERE project_id IN (${placeholders})`,
        params: projectIds
      }),
      runTimedQuery({
        label: 'project_palette',
        sql: `SELECT id, project_id, name, hex FROM project_palette WHERE project_id IN (${placeholders}) ORDER BY project_id ASC, position ASC, id ASC`,
        params: projectIds
      })
    ]);

    queryTimings.push(
      brushNormsQuery.timing,
      typographyNormsQuery.timing,
      paletteQuery.timing
    );

    const brushNormsByProjectId = groupRowsByProjectId(
      brushNormsQuery.rows,
      (norm) => ({
        id: norm.id,
        name: norm.name,
        value: norm.value,
        unit: norm.unit,
        brushName: norm.brush_name,
        opacity: norm.opacity
      })
    );

    const typographyNormsByProjectId = groupRowsByProjectId(
      typographyNormsQuery.rows,
      (norm) => ({
        id: norm.id,
        fontFamily: norm.font_family,
        fontWeight: norm.font_weight,
        fontUsage: norm.font_usage,
        fontStyle: norm.font_style
      })
    );

    const paletteByProjectId = groupRowsByProjectId(
      paletteQuery.rows,
      (color) => ({
        id: color.id,
        name: color.name,
        hex: color.hex
      })
    );

    const fullProjects = projectsData.map((project) => {
      const projectId = Number(project.id);
      const brushNorms = brushNormsByProjectId.get(projectId) || [];
      const typographyNorms = typographyNormsByProjectId.get(projectId) || [];
      const palette = paletteByProjectId.get(projectId) || [];

      return {
        id: project.id,
        name: project.name,
        lastEdited: project.lastEditedFormatted || 'À l\'instant',
        brushNorms,
        typographyNorms,
        normsCount: brushNorms.length + typographyNorms.length,
        palette
      };
    });

    logListProjectsPerformance({
      req,
      userId,
      projectCount: projectsData.length,
      queryTimings
    });

    res.json(fullProjects);
  } catch (error) {
    logProjectsControllerError(req, 'list', error);
    res.status(500).json({ error: 'Erreur base de données' });
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
      'INSERT INTO projects (user_id, name) VALUES (?, ?)',
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
    await db.query('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    logProjectsControllerError(req, 'delete', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

/**
 * Adds a brush norm to a project after ownership and payload validation, then
 * touches the project's last_edited timestamp.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const addBrushNorm = async (req, res) => {
  const { id } = req.params;
  const { name, value, unit, brushName, opacity } = req.body;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;

    const validatedBrushNorm = validateBrushNormPayload({ name, value, unit, brushName, opacity });
    if (validatedBrushNorm.error) {
      return res.status(400).json({ error: validatedBrushNorm.error });
    }

    const [result] = await db.query(
      'INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name, opacity) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        validatedBrushNorm.value.name,
        validatedBrushNorm.value.value,
        validatedBrushNorm.value.unit,
        validatedBrushNorm.value.brushName,
        validatedBrushNorm.value.opacity
      ]
    );
    await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    logProjectsControllerError(req, 'add_brush_norm', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  }
};

/**
 * Adds a typography norm to a project after ownership and payload validation,
 * then touches the project's last_edited timestamp.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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

/**
 * Replaces a project's color palette with the provided ordered array of colors,
 * atomically (single transaction, rolled back on any error). The array order is
 * persisted in the `position` column so the palette reloads in the same order.
 *
 * Each color may carry an `id` (an existing color to update in place) or none (a
 * new color to insert). Existing colors absent from the array are deleted, so
 * this endpoint genuinely *replaces* the palette. Colors are addressed by id
 * rather than hex, so two colors may share the same hex without colliding.
 * Responds with the canonical palette (with ids) in its persisted order.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const updatePalette = async (req, res) => {
  const { id } = req.params;
  const colors = req.body;

  if (!Array.isArray(colors)) {
    return res.status(400).json({ error: 'La palette doit être un tableau de couleurs.' });
  }
  if (colors.length > MAX_PALETTE_SIZE) {
    return res.status(400).json({ error: `La palette ne peut pas dépasser ${MAX_PALETTE_SIZE} couleurs.` });
  }

  // Validate and normalize every color up front, before opening a transaction.
  const validatedColors = [];
  for (const color of colors) {
    const hexCheck = validateHexColorField(color?.hex);
    if (hexCheck.error) {
      return res.status(400).json({ error: buildInvalidHexColorError(color?.hex) });
    }
    const nameCheck = sanitizeOptionalTextField(color?.name, { maxLength: 255 });
    if (nameCheck.error) {
      return res.status(400).json({ error: 'Le nom de la couleur est invalide.' });
    }
    let colorId = null;
    if (color?.id !== undefined && color?.id !== null) {
      const parsedId = Number(color.id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        return res.status(400).json({ error: 'Identifiant de couleur invalide.' });
      }
      colorId = parsedId;
    }
    validatedColors.push({ id: colorId, name: nameCheck.value, hex: hexCheck.value });
  }

  let connection;
  try {
    if (!(await ensureProjectOwnership(req, res, id))) return;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ids that currently belong to this project, used both to detect removals
    // and to ensure a client-supplied id can't target another project's color.
    const [existingRows] = await connection.query(
      'SELECT id FROM project_palette WHERE project_id = ?',
      [id]
    );
    const existingIds = new Set(existingRows.map((row) => row.id));

    // Keep only the ids the client sent that actually belong to this project.
    const keptIds = validatedColors
      .filter((color) => color.id !== null && existingIds.has(color.id))
      .map((color) => color.id);

    // Delete the colors that are no longer present in the new palette.
    if (keptIds.length > 0) {
      const placeholders = keptIds.map(() => '?').join(', ');
      await connection.query(
        `DELETE FROM project_palette WHERE project_id = ? AND id NOT IN (${placeholders})`,
        [id, ...keptIds]
      );
    } else {
      await connection.query('DELETE FROM project_palette WHERE project_id = ?', [id]);
    }

    // Upsert each color at its array index, which becomes its persisted position.
    for (let position = 0; position < validatedColors.length; position += 1) {
      const color = validatedColors[position];
      if (color.id !== null && existingIds.has(color.id)) {
        await connection.query(
          'UPDATE project_palette SET name = ?, hex = ?, position = ? WHERE id = ? AND project_id = ?',
          [color.name, color.hex, position, color.id, id]
        );
      } else {
        await connection.query(
          'INSERT INTO project_palette (project_id, name, hex, position) VALUES (?, ?, ?, ?)',
          [id, color.name, color.hex, position]
        );
      }
    }

    await connection.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [id]);

    // Return the saved palette (with ids) in its persisted order so the client
    // can adopt the canonical state.
    const [paletteRows] = await connection.query(
      'SELECT id, name, hex FROM project_palette WHERE project_id = ? ORDER BY position ASC, id ASC',
      [id]
    );

    await connection.commit();
    res.json({ success: true, palette: paletteRows });
  } catch (error) {
    if (connection) await connection.rollback();
    logProjectsControllerError(req, 'update_palette', error, { projectId: id });
    res.status(500).json({ error: 'Erreur base de données' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Deletes a brush norm from a project. The DELETE is scoped by both norm id and
 * project id (in addition to the ownership check) so a norm can only be removed
 * from a project the caller owns.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
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

    const validatedBrushNorm = validateBrushNormPayload({ name, value, unit, brushName, opacity });
    if (validatedBrushNorm.error) {
      return res.status(400).json({ error: validatedBrushNorm.error });
    }

    const [result] = await db.query(
      'UPDATE project_brush_norms SET name = ?, value = ?, unit = ?, brush_name = ?, opacity = ? WHERE id = ? AND project_id = ?',
      [
        validatedBrushNorm.value.name,
        validatedBrushNorm.value.value,
        validatedBrushNorm.value.unit,
        validatedBrushNorm.value.brushName,
        validatedBrushNorm.value.opacity,
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
  updateBrushNorm,
  updateTypographyNorm
};
