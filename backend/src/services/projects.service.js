/**
 * Projects service: business logic and SQL for projects and their nested style
 * references (palettes, brush norms, typography norms). Never touches req/res.
 */

const db = require('../database');
const validator = require('validator');
const { logger } = require('../utils/logger');

// Upper bound on palette size to cap per-request work and storage.
const MAX_PALETTE_SIZE = 50;

// Project-list pagination: default page size, and a hard cap so a client cannot
// request an unbounded page and defeat the point of paginating.
const DEFAULT_PROJECTS_PAGE_SIZE = 12;
const MAX_PROJECTS_PAGE_SIZE = 50;

// Thrown to signal a business/validation failure the controller maps to an HTTP status + message.
class ProjectServiceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ProjectServiceError';
    this.code = code;
  }
}

// Ownership guard preventing IDOR: confirms the user owns the project so no one
// can read/mutate another user's project by guessing its id. Returns true/false;
// the controller maps false to a 403.
const userOwnsProject = async (userId, projectId) => {
  const [rows] = await db.query('SELECT id FROM projects WHERE id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);

  return rows.length > 0;
};

// Normalizes an optional text field (null/undefined -> no value), coercing,
// trimming and length-capping. Returns { value } or { error } so callers branch
// without throwing.
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
const buildInvalidHexColorError = (value) =>
  `Invalid color: the hex value "${value}" is not a valid format (#RGB or #RRGGBB).`;

// Validates a hex color (leading '#', #RGB/#RRGGBB). Returns { value } or { error }.
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

// Validates/normalizes a brush norm: required name, positive capped value, unit
// (letters/percent), optional brush name, optional opacity in 0-1. Returns the
// normalized fields or the first error.
const validateBrushNormPayload = ({ name, value, unit, brushName, opacity }) => {
  if (typeof name !== 'string') {
    return { error: 'The brush usage is invalid.' };
  }

  const trimmedName = validator.trim(name);
  if (!validator.isLength(trimmedName, { min: 1, max: 255 })) {
    return { error: 'The brush usage is invalid.' };
  }

  const valueAsString = typeof value === 'number' ? String(value) : value;
  if (typeof valueAsString !== 'string') {
    return { error: 'The brush size must be a positive number.' };
  }

  const trimmedValue = validator.trim(valueAsString);
  if (!validator.isFloat(trimmedValue, { gt: 0, max: 1000 })) {
    return { error: 'The brush size must be a positive number.' };
  }

  const unitInput = unit === undefined || unit === null ? 'px' : unit;
  if (typeof unitInput !== 'string') {
    return { error: 'The brush unit is invalid.' };
  }

  const trimmedUnit = validator.trim(unitInput);
  if (
    !validator.isLength(trimmedUnit, { min: 1, max: 20 }) ||
    !validator.matches(trimmedUnit, /^[a-zA-Z%]+$/)
  ) {
    return { error: 'The brush unit is invalid.' };
  }

  const normalizedBrushName = sanitizeOptionalTextField(brushName, { maxLength: 255 });
  if (normalizedBrushName.error) {
    return { error: 'The brush name is invalid.' };
  }

  let validatedOpacity = null;
  if (opacity !== undefined) {
    if (typeof opacity === 'string' || typeof opacity === 'number') {
      const opStr = String(opacity).trim();
      if (validator.isFloat(opStr, { min: 0, max: 1 })) {
        validatedOpacity = parseFloat(opStr);
      } else {
        return { error: 'Opacity must be a number between 0 and 1.' };
      }
    } else {
      return { error: 'Opacity must be a number between 0 and 1.' };
    }
  }
  return {
    value: {
      name: trimmedName,
      value: trimmedValue,
      unit: trimmedUnit,
      brushName: normalizedBrushName.value,
      opacity: validatedOpacity,
    },
  };
};

// Validates/normalizes a typography norm: required font family plus optional
// length-bounded weight, usage and style. Returns the normalized fields or an error.
const validateTypographyNormPayload = ({ fontFamily, fontWeight, fontUsage, fontStyle }) => {
  if (typeof fontFamily !== 'string') {
    return { error: 'The font family is invalid.' };
  }

  const trimmedFontFamily = validator.trim(fontFamily);
  if (!validator.isLength(trimmedFontFamily, { min: 1, max: 255 })) {
    return { error: 'The font family is invalid.' };
  }

  const normalizedFontWeight = sanitizeOptionalTextField(fontWeight, { maxLength: 100 });
  if (normalizedFontWeight.error) {
    return { error: 'The font weight is invalid.' };
  }

  const normalizedFontUsage = sanitizeOptionalTextField(fontUsage, { maxLength: 255 });
  if (normalizedFontUsage.error) {
    return { error: 'The typography usage is invalid.' };
  }

  const normalizedFontStyle = sanitizeOptionalTextField(fontStyle, { maxLength: 100 });
  if (normalizedFontStyle.error) {
    return { error: 'The font style is invalid.' };
  }

  return {
    value: {
      fontFamily: trimmedFontFamily,
      fontWeight: normalizedFontWeight.value,
      fontUsage: normalizedFontUsage.value,
      fontStyle: normalizedFontStyle.value,
    },
  };
};

// Runs a SQL query and returns its rows plus timing metadata, to instrument the
// list endpoint for performance logging.
const runTimedQuery = async ({ label, sql, params }) => {
  const startedAt = process.hrtime.bigint();
  const [rows] = await db.query(sql, params);
  const durationMs = Number((Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(2));

  return {
    rows,
    timing: {
      label,
      durationMs,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    },
  };
};

// Buckets child rows by project_id (applying mapper), so children fetched in one
// query can be assembled per project in memory, avoiding a query per project (N+1).
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

// Logs list-endpoint SQL timing at debug level for local profiling only. It is a
// developer aid, not an operational metric, so it stays out of the default (info)
// log stream in production.
const logListProjectsPerformance = ({ requestId, userId, projectCount, queryTimings }) => {
  const totalSqlTimeMs = Number(
    queryTimings
      .reduce((accumulator, queryTiming) => accumulator + queryTiming.durationMs, 0)
      .toFixed(2),
  );

  logger.debug('projects.list.performance', {
    requestId,
    userId,
    projectCount,
    sqlQueries: queryTimings.length,
    totalSqlTimeMs,
    sqlTimings: queryTimings,
  });
};

// Lists a page of the user's projects, each enriched with its brush norms,
// typography norms and palette. Children are fetched in three parallel batched
// IN-list queries and grouped in memory, avoiding N+1. Returns { projects,
// pagination: { page, pageSize, total, totalPages } }.
const listProjectsForUser = async (userId, requestId, options = {}) => {
  const queryTimings = [];

  // Clamp pagination inputs to safe bounds (default page 1, capped page size).
  const page = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
  const pageSize = Number.isFinite(options.pageSize)
    ? Math.min(MAX_PROJECTS_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize)))
    : DEFAULT_PROJECTS_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // Total count drives the pagination metadata (and the dashboard's "N projects").
  const countQuery = await runTimedQuery({
    label: 'projects_count',
    sql: 'SELECT COUNT(*) AS total FROM projects WHERE user_id = ?',
    params: [userId],
  });
  queryTimings.push(countQuery.timing);
  const total = Number(countQuery.rows[0]?.total || 0);
  const pagination = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };

  const projectsQuery = await runTimedQuery({
    label: 'projects',
    sql: 'SELECT id, name, DATE_FORMAT(last_edited, "%d/%m %H:%i") as lastEditedFormatted FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    params: [userId, pageSize, offset],
  });

  queryTimings.push(projectsQuery.timing);

  const projectsData = projectsQuery.rows;
  if (projectsData.length === 0) {
    logListProjectsPerformance({
      requestId,
      userId,
      projectCount: 0,
      queryTimings,
    });

    return { projects: [], pagination };
  }

  const projectIds = projectsData.map((project) => Number(project.id));
  // Bind ids as parameters (not string-interpolated) to keep the IN clause injection-safe.
  const placeholders = projectIds.map(() => '?').join(', ');

  // Fetch all children for all projects in three parallel batched queries.
  const [brushNormsQuery, typographyNormsQuery, paletteQuery] = await Promise.all([
    runTimedQuery({
      label: 'project_brush_norms',
      sql: `SELECT id, project_id, name, value, unit, brush_name, opacity FROM project_brush_norms WHERE project_id IN (${placeholders})`,
      params: projectIds,
    }),
    runTimedQuery({
      label: 'project_typography_norms',
      sql: `SELECT id, project_id, font_family, font_weight, font_usage, font_style FROM project_typography_norms WHERE project_id IN (${placeholders})`,
      params: projectIds,
    }),
    runTimedQuery({
      label: 'project_palette',
      sql: `SELECT id, project_id, name, hex FROM project_palette WHERE project_id IN (${placeholders}) ORDER BY project_id ASC, position ASC, id ASC`,
      params: projectIds,
    }),
  ]);

  queryTimings.push(brushNormsQuery.timing, typographyNormsQuery.timing, paletteQuery.timing);

  const brushNormsByProjectId = groupRowsByProjectId(brushNormsQuery.rows, (norm) => ({
    id: norm.id,
    name: norm.name,
    value: norm.value,
    unit: norm.unit,
    brushName: norm.brush_name,
    opacity: norm.opacity,
  }));

  const typographyNormsByProjectId = groupRowsByProjectId(typographyNormsQuery.rows, (norm) => ({
    id: norm.id,
    fontFamily: norm.font_family,
    fontWeight: norm.font_weight,
    fontUsage: norm.font_usage,
    fontStyle: norm.font_style,
  }));

  const paletteByProjectId = groupRowsByProjectId(paletteQuery.rows, (color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
  }));

  const fullProjects = projectsData.map((project) => {
    const projectId = Number(project.id);
    const brushNorms = brushNormsByProjectId.get(projectId) || [];
    const typographyNorms = typographyNormsByProjectId.get(projectId) || [];
    const palette = paletteByProjectId.get(projectId) || [];

    return {
      id: project.id,
      name: project.name,
      lastEdited: project.lastEditedFormatted || 'Just now',
      brushNorms,
      typographyNorms,
      normsCount: brushNorms.length + typographyNorms.length,
      palette,
    };
  });

  logListProjectsPerformance({
    requestId,
    userId,
    projectCount: projectsData.length,
    queryTimings,
  });

  return { projects: fullProjects, pagination };
};

// Creates an empty project after validating the name. Throws 'missing_name' or
// 'invalid_name' (trimmed length out of range).
const createProjectForUser = async (userId, rawName) => {
  if (!rawName) {
    throw new ProjectServiceError('missing_name');
  }
  const name = validator.trim(rawName);
  if (!validator.isLength(name, { min: 2, max: 50 })) {
    throw new ProjectServiceError('invalid_name');
  }

  const [result] = await db.query('INSERT INTO projects (user_id, name) VALUES (?, ?)', [
    userId,
    name,
  ]);
  const newId = result.insertId;

  return {
    id: newId,
    name,
    lastEdited: 'Just now',
    normsCount: 0,
    norms: [],
    palette: [],
  };
};

// Renames a project (name already validated) and refreshes last_edited.
const renameProject = async (projectId, name) => {
  await db.query('UPDATE projects SET name = ?, last_edited = NOW() WHERE id = ?', [
    name.trim(),
    projectId,
  ]);
  return { success: true, name: name.trim() };
};

// Deletes a project; child norms and palette cascade via the schema's foreign keys.
const deleteProjectById = async (projectId) => {
  await db.query('DELETE FROM projects WHERE id = ?', [projectId]);
  return { success: true };
};

// Adds a brush norm after validation, then touches last_edited. Throws
// 'validation' (with the user-facing message) on an invalid payload.
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
      validatedBrushNorm.value.opacity,
    ],
  );
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true, id: result.insertId };
};

// Adds a typography norm after validation, then touches last_edited. Throws
// 'validation' on an invalid payload.
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
      validatedTypographyNorm.value.fontStyle,
    ],
  );
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true, id: result.insertId };
};

// Validates a palette payload before any DB work. Returns normalized colors
// ({ id, name, hex }) or throws 'validation' on the first invalid color/shape.
const validatePalettePayload = (colors) => {
  if (!Array.isArray(colors)) {
    throw new ProjectServiceError('validation', 'The palette must be an array of colors.');
  }
  if (colors.length > MAX_PALETTE_SIZE) {
    throw new ProjectServiceError(
      'validation',
      `The palette cannot exceed ${MAX_PALETTE_SIZE} colors.`,
    );
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
      throw new ProjectServiceError('validation', 'The color name is invalid.');
    }
    let colorId = null;
    if (color?.id !== undefined && color?.id !== null) {
      const parsedId = Number(color.id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new ProjectServiceError('validation', 'Invalid color identifier.');
      }
      colorId = parsedId;
    }
    validatedColors.push({ id: colorId, name: nameCheck.value, hex: hexCheck.value });
  }

  return validatedColors;
};

// Atomically replaces a project's palette (single transaction, rolled back on
// error). Array order is persisted in `position`. Colors with an `id` update in
// place, others insert, and existing colors absent from the array are deleted -
// so it genuinely replaces. Addressing by id (not hex) lets two colors share a
// hex without colliding. Returns the canonical palette (with ids) in order.
const replaceProjectPalette = async (projectId, validatedColors) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Ids that currently belong to this project, used both to detect removals
    // and to ensure a client-supplied id can't target another project's color.
    const [existingRows] = await connection.query(
      'SELECT id FROM project_palette WHERE project_id = ?',
      [projectId],
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
        [projectId, ...keptIds],
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
          [color.name, color.hex, position, color.id, projectId],
        );
      } else {
        await connection.query(
          'INSERT INTO project_palette (project_id, name, hex, position) VALUES (?, ?, ?, ?)',
          [projectId, color.name, color.hex, position],
        );
      }
    }

    await connection.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);

    // Return the saved palette (with ids) so the client can adopt the canonical state.
    const [paletteRows] = await connection.query(
      'SELECT id, name, hex FROM project_palette WHERE project_id = ? ORDER BY position ASC, id ASC',
      [projectId],
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

// Deletes a brush norm, scoped by both norm id and project id (defense in depth
// beyond the ownership check). Returns false when no row matched.
const deleteBrushNormFromProject = async (projectId, normId) => {
  const [result] = await db.query(
    'DELETE FROM project_brush_norms WHERE id = ? AND project_id = ?',
    [normId, projectId],
  );
  return result.affectedRows > 0;
};

// Deletes a typography norm, scoped by norm id and project id. Returns false when no row matched.
const deleteTypographyNormFromProject = async (projectId, normId) => {
  const [result] = await db.query(
    'DELETE FROM project_typography_norms WHERE id = ? AND project_id = ?',
    [normId, projectId],
  );
  return result.affectedRows > 0;
};

// Updates a brush norm after validation, scoped by norm id and project id;
// refreshes last_edited. Throws 'validation' on a bad payload, 'not_found' when no row matched.
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
      projectId,
    ],
  );
  if (result.affectedRows === 0) {
    throw new ProjectServiceError('not_found');
  }
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true };
};

// Updates a typography norm after validation, scoped by norm id and project id;
// refreshes last_edited. Throws 'validation' on a bad payload, 'not_found' when no row matched.
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
      projectId,
    ],
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
  updateTypographyNormInProject,
};
