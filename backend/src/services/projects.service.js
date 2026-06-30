/**
 * Projects service.
 *
 * Owns the business logic and SQL for projects and their nested style
 * references: color palettes, brush norms and typography norms. Functions take
 * plain arguments (user id, project id, validated payloads) and return data, or
 * throw a typed error carrying a `code`/`status` the controller maps to an HTTP
 * response. The service never touches the Express req/res objects.
 */

const db = require('../database');
const validator = require('validator');
const { logger } = require('../utils/logger');

// Upper bound on palette size to cap per-request work and storage.
const MAX_PALETTE_SIZE = 50;

/**
 * Error type thrown by service functions to signal a business/validation
 * failure that the controller translates into a specific HTTP status + message.
 */
class ProjectServiceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ProjectServiceError';
    this.code = code;
  }
}

/**
 * Authorization guard: confirms the authenticated user owns the given project.
 * Centralizing this check prevents IDOR (insecure direct object reference) where
 * one user could read or mutate another user's project by guessing its id.
 * Unlike the previous controller helper, this function does not touch the
 * response: it returns true/false so the controller maps a false result to its
 * 403 response.
 * @param {number} userId Authenticated user id.
 * @param {number|string} projectId Target project id.
 * @returns {Promise<boolean>} True if the user owns the project.
 */
const userOwnsProject = async (userId, projectId) => {
  const [rows] = await db.query(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?',
    [projectId, userId]
  );

  return rows.length > 0;
};

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
 * @param {{requestId:*, userId:number, projectCount:number, queryTimings:Array}} params
 */
const logListProjectsPerformance = ({ requestId, userId, projectCount, queryTimings }) => {
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
    requestId,
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
 * Lists all projects owned by the user, each enriched with its brush norms,
 * typography norms and palette. Children are fetched with three batched IN-list
 * queries (run in parallel) and grouped in memory, avoiding the N+1 query
 * pattern that fetching children per project would cause.
 * @param {number} userId Authenticated user id.
 * @param {*} requestId Request id used for performance logging.
 * @returns {Promise<Array>} The assembled projects.
 */
const listProjectsForUser = async (userId, requestId) => {
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
      requestId,
      userId,
      projectCount: 0,
      queryTimings
    });

    return [];
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
    requestId,
    userId,
    projectCount: projectsData.length,
    queryTimings
  });

  return fullProjects;
};

/**
 * Creates a new empty project for the user after validating the project name.
 * Throws ProjectServiceError('missing_name') when no name is supplied and
 * ProjectServiceError('invalid_name') when the trimmed name is out of range.
 * @param {number} userId Authenticated user id.
 * @param {*} rawName Raw project name from the request body.
 * @returns {Promise<Object>} The created project's client representation.
 */
const createProjectForUser = async (userId, rawName) => {
  if (!rawName) {
    throw new ProjectServiceError('missing_name');
  }
  const name = validator.trim(rawName);
  if (!validator.isLength(name, { min: 2, max: 50 })) {
    throw new ProjectServiceError('invalid_name');
  }

  const [result] = await db.query(
    'INSERT INTO projects (user_id, name) VALUES (?, ?)',
    [userId, name]
  );
  const newId = result.insertId;

  return {
    id: newId,
    name,
    lastEdited: 'À l\'instant',
    normsCount: 0,
    norms: [],
    palette: []
  };
};

/**
 * Renames a project and refreshes its last_edited timestamp.
 * @param {number|string} projectId Target project id.
 * @param {string} name Already-validated, untrimmed name.
 * @returns {Promise<{success:boolean, name:string}>}
 */
const renameProject = async (projectId, name) => {
  await db.query('UPDATE projects SET name = ?, last_edited = NOW() WHERE id = ?', [name.trim(), projectId]);
  return { success: true, name: name.trim() };
};

/**
 * Deletes a project (cascading to its child norms and palette via the schema's
 * foreign keys).
 * @param {number|string} projectId Target project id.
 * @returns {Promise<{success:boolean}>}
 */
const deleteProjectById = async (projectId) => {
  await db.query('DELETE FROM projects WHERE id = ?', [projectId]);
  return { success: true };
};

/**
 * Adds a brush norm to a project after payload validation, then touches the
 * project's last_edited timestamp. Throws ProjectServiceError('validation', msg)
 * with the user-facing message when the payload is invalid.
 * @param {number|string} projectId Target project id.
 * @param {Object} payload Raw brush norm payload.
 * @returns {Promise<{success:boolean, id:number}>}
 */
const addBrushNormToProject = async (projectId, payload) => {
  const validatedBrushNorm = validateBrushNormPayload(payload);
  if (validatedBrushNorm.error) {
    throw new ProjectServiceError('validation', validatedBrushNorm.error);
  }

  const [result] = await db.query(
    'INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name, opacity) VALUES (?, ?, ?, ?, ?, ?)',
    [
      projectId,
      validatedBrushNorm.value.name,
      validatedBrushNorm.value.value,
      validatedBrushNorm.value.unit,
      validatedBrushNorm.value.brushName,
      validatedBrushNorm.value.opacity
    ]
  );
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true, id: result.insertId };
};

/**
 * Adds a typography norm to a project after payload validation, then touches the
 * project's last_edited timestamp. Throws ProjectServiceError('validation', msg)
 * when the payload is invalid.
 * @param {number|string} projectId Target project id.
 * @param {Object} payload Raw typography norm payload.
 * @returns {Promise<{success:boolean, id:number}>}
 */
const addTypographyNormToProject = async (projectId, payload) => {
  const validatedTypographyNorm = validateTypographyNormPayload(payload);
  if (validatedTypographyNorm.error) {
    throw new ProjectServiceError('validation', validatedTypographyNorm.error);
  }

  const [result] = await db.query(
    'INSERT INTO project_typography_norms (project_id, font_family, font_weight, font_usage, font_style) VALUES (?, ?, ?, ?, ?)',
    [
      projectId,
      validatedTypographyNorm.value.fontFamily,
      validatedTypographyNorm.value.fontWeight,
      validatedTypographyNorm.value.fontUsage,
      validatedTypographyNorm.value.fontStyle
    ]
  );
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true, id: result.insertId };
};

/**
 * Validates a palette payload before any database work. Returns the normalized
 * colors, or throws ProjectServiceError('validation', msg) with the user-facing
 * message on the first invalid color/shape encountered.
 * @param {*} colors Raw palette array from the request body.
 * @returns {Array<{id:(number|null), name:(string|null), hex:string}>}
 */
const validatePalettePayload = (colors) => {
  if (!Array.isArray(colors)) {
    throw new ProjectServiceError('validation', 'La palette doit être un tableau de couleurs.');
  }
  if (colors.length > MAX_PALETTE_SIZE) {
    throw new ProjectServiceError('validation', `La palette ne peut pas dépasser ${MAX_PALETTE_SIZE} couleurs.`);
  }

  // Validate and normalize every color up front, before opening a transaction.
  const validatedColors = [];
  for (const color of colors) {
    const hexCheck = validateHexColorField(color?.hex);
    if (hexCheck.error) {
      throw new ProjectServiceError('validation', buildInvalidHexColorError(color?.hex));
    }
    const nameCheck = sanitizeOptionalTextField(color?.name, { maxLength: 255 });
    if (nameCheck.error) {
      throw new ProjectServiceError('validation', 'Le nom de la couleur est invalide.');
    }
    let colorId = null;
    if (color?.id !== undefined && color?.id !== null) {
      const parsedId = Number(color.id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new ProjectServiceError('validation', 'Identifiant de couleur invalide.');
      }
      colorId = parsedId;
    }
    validatedColors.push({ id: colorId, name: nameCheck.value, hex: hexCheck.value });
  }

  return validatedColors;
};

/**
 * Replaces a project's color palette with the provided validated colors,
 * atomically (single transaction, rolled back on any error). The array order is
 * persisted in the `position` column so the palette reloads in the same order.
 *
 * Each color may carry an `id` (an existing color to update in place) or none (a
 * new color to insert). Existing colors absent from the array are deleted, so
 * this genuinely *replaces* the palette. Colors are addressed by id rather than
 * hex, so two colors may share the same hex without colliding. Returns the
 * canonical palette (with ids) in its persisted order.
 * @param {number|string} projectId Target project id.
 * @param {Array} validatedColors Colors already validated by validatePalettePayload.
 * @returns {Promise<{success:boolean, palette:Array}>}
 */
const replaceProjectPalette = async (projectId, validatedColors) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ids that currently belong to this project, used both to detect removals
    // and to ensure a client-supplied id can't target another project's color.
    const [existingRows] = await connection.query(
      'SELECT id FROM project_palette WHERE project_id = ?',
      [projectId]
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
        [projectId, ...keptIds]
      );
    } else {
      await connection.query('DELETE FROM project_palette WHERE project_id = ?', [projectId]);
    }

    // Upsert each color at its array index, which becomes its persisted position.
    for (let position = 0; position < validatedColors.length; position += 1) {
      const color = validatedColors[position];
      if (color.id !== null && existingIds.has(color.id)) {
        await connection.query(
          'UPDATE project_palette SET name = ?, hex = ?, position = ? WHERE id = ? AND project_id = ?',
          [color.name, color.hex, position, color.id, projectId]
        );
      } else {
        await connection.query(
          'INSERT INTO project_palette (project_id, name, hex, position) VALUES (?, ?, ?, ?)',
          [projectId, color.name, color.hex, position]
        );
      }
    }

    await connection.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);

    // Return the saved palette (with ids) in its persisted order so the client
    // can adopt the canonical state.
    const [paletteRows] = await connection.query(
      'SELECT id, name, hex FROM project_palette WHERE project_id = ? ORDER BY position ASC, id ASC',
      [projectId]
    );

    await connection.commit();
    return { success: true, palette: paletteRows };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Deletes a brush norm from a project. The DELETE is scoped by both norm id and
 * project id (in addition to the ownership check) so a norm can only be removed
 * from a project the caller owns. Returns false when no row matched.
 * @param {number|string} projectId Target project id.
 * @param {number|string} normId Target norm id.
 * @returns {Promise<boolean>} True if a norm was deleted.
 */
const deleteBrushNormFromProject = async (projectId, normId) => {
  const [result] = await db.query('DELETE FROM project_brush_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
  return result.affectedRows > 0;
};

/**
 * Deletes a typography norm from a project, scoped by norm id and project id in
 * addition to the ownership check. Returns false when no row matched.
 * @param {number|string} projectId Target project id.
 * @param {number|string} normId Target norm id.
 * @returns {Promise<boolean>} True if a norm was deleted.
 */
const deleteTypographyNormFromProject = async (projectId, normId) => {
  const [result] = await db.query('DELETE FROM project_typography_norms WHERE id = ? AND project_id = ?', [normId, projectId]);
  return result.affectedRows > 0;
};

/**
 * Updates an existing brush norm after payload validation. The UPDATE is scoped
 * by norm id and project id, and last_edited is refreshed. Throws
 * ProjectServiceError('validation', msg) on an invalid payload and
 * ProjectServiceError('not_found') when no row matched.
 * @param {number|string} projectId Target project id.
 * @param {number|string} normId Target norm id.
 * @param {Object} payload Raw brush norm payload.
 * @returns {Promise<{success:boolean}>}
 */
const updateBrushNormInProject = async (projectId, normId, payload) => {
  const validatedBrushNorm = validateBrushNormPayload(payload);
  if (validatedBrushNorm.error) {
    throw new ProjectServiceError('validation', validatedBrushNorm.error);
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
    throw new ProjectServiceError('not_found');
  }
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true };
};

/**
 * Updates an existing typography norm after payload validation. The UPDATE is
 * scoped by norm id and project id, and last_edited is refreshed. Throws
 * ProjectServiceError('validation', msg) on an invalid payload and
 * ProjectServiceError('not_found') when no row matched.
 * @param {number|string} projectId Target project id.
 * @param {number|string} normId Target norm id.
 * @param {Object} payload Raw typography norm payload.
 * @returns {Promise<{success:boolean}>}
 */
const updateTypographyNormInProject = async (projectId, normId, payload) => {
  const validatedTypographyNorm = validateTypographyNormPayload(payload);
  if (validatedTypographyNorm.error) {
    throw new ProjectServiceError('validation', validatedTypographyNorm.error);
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
    throw new ProjectServiceError('not_found');
  }
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true };
};

module.exports = {
  ProjectServiceError,
  userOwnsProject,
  listProjectsForUser,
  createProjectForUser,
  renameProject,
  deleteProjectById,
  addBrushNormToProject,
  addTypographyNormToProject,
  validatePalettePayload,
  replaceProjectPalette,
  deleteBrushNormFromProject,
  deleteTypographyNormFromProject,
  updateBrushNormInProject,
  updateTypographyNormInProject
};
