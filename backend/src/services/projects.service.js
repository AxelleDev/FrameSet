/**
 * Projects service: business logic and SQL for projects and their nested style
 * references (palettes, brush norms, typography norms). Never touches req/res.
 */

const db = require('../database');
const validator = require('validator');
const { logger } = require('../utils/logger');
const { ProjectServiceError } = require('./projects.errors');
// Trash and sharing live in dedicated services (projectTrash.service.js /
// projectSharing.service.js); they are required here so this module keeps
// exporting the whole projects surface as one facade for the controller.
const {
  TRASH_RETENTION_DAYS,
  TRASHABLE_CHILD_TABLES,
  deleteProjectById,
  listTrashedProjectsForUser,
  restoreProjectForUser,
  deleteProjectPermanently,
  purgeExpiredTrashedProjects,
  purgeExpiredTrashedProjectItems,
  deleteBrushNormFromProject,
  deleteTypographyNormFromProject,
  restoreBrushNormInProject,
  restoreTypographyNormInProject,
  deleteBrushNormPermanently,
  deleteTypographyNormPermanently,
  listTrashedBrushNormsForProject,
  listTrashedTypographyNormsForProject,
  deletePaletteColorFromProject,
  restorePaletteColorInProject,
  deletePaletteColorPermanently,
  listTrashedPaletteColorsForProject,
} = require('./projectTrash.service');
const {
  fetchLiveProjectChildren,
  enableProjectSharing,
  disableProjectSharing,
  getSharedProjectByToken,
} = require('./projectSharing.service');

// Upper bound on palette size to cap per-request work and storage.
const MAX_PALETTE_SIZE = 50;

// Project-list pagination: default page size, and a hard cap so a client cannot
// request an unbounded page and defeat the point of paginating.
const DEFAULT_PROJECTS_PAGE_SIZE = 12;
const MAX_PROJECTS_PAGE_SIZE = 50;

// Escapes the LIKE pattern metacharacters (% _ and the escape char itself) in a
// user-supplied search term, so "50%" matches a literal "50%" instead of turning
// into a wildcard that matches everything. MySQL's default LIKE escape is "\".
const escapeLikeWildcards = (value) => value.replace(/[\\%_]/g, '\\$&');

// Ownership guard preventing IDOR: confirms the user owns the project so no one
// can read/mutate another user's project by guessing its id. Trashed projects
// don't pass (they are only reachable via the trash endpoints). Returns
// true/false; the controller maps false to a 403.
const userOwnsProject = async (userId, projectId) => {
  const [rows] = await db.query(
    'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [projectId, userId],
  );

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

// Leading '#' plus exactly 3 or 6 hex digits. Deliberately narrower than
// validator.isHexColor (which also accepts the 4/8-digit #RGBA/#RRGGBBAA
// forms): an alpha channel would silently survive storage but isn't handled by
// the HSL/HSB conversions or the PDF/palette-file exporters downstream.
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Validates a hex color (leading '#', #RGB/#RRGGBB only). Returns { value } or { error }.
const validateHexColorField = (value) => {
  if (typeof value !== 'string') {
    return { error: 'invalid_hex' };
  }

  const trimmedValue = validator.trim(value);
  if (!HEX_COLOR_PATTERN.test(trimmedValue)) {
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

  // An empty string means "left blank" (the field is optional), same as not
  // sending it at all — not an invalid value to reject.
  let validatedOpacity = null;
  if (opacity !== undefined && opacity !== '') {
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
// IN-list queries and grouped in memory, avoiding N+1. Pinned projects always
// sort first (by their manual pin order), then the rest by recency. An
// optional `search` filters by name (case-insensitive substring). Returns
// { projects, pagination: { page, pageSize, total, totalPages } }.
const listProjectsForUser = async (userId, requestId, options = {}) => {
  const queryTimings = [];

  // Clamp pagination inputs to safe bounds (default page 1, capped page size).
  const page = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
  const pageSize = Number.isFinite(options.pageSize)
    ? Math.min(MAX_PROJECTS_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize)))
    : DEFAULT_PROJECTS_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const search = typeof options.search === 'string' ? options.search.trim() : '';
  const searchClause = search ? 'AND name LIKE ?' : '';
  const searchParam = search ? [`%${escapeLikeWildcards(search)}%`] : [];

  // Total count drives the pagination metadata (and the dashboard's "N projects").
  const countQuery = await runTimedQuery({
    label: 'projects_count',
    sql: `SELECT COUNT(*) AS total FROM projects WHERE user_id = ? AND deleted_at IS NULL ${searchClause}`,
    params: [userId, ...searchParam],
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
    sql: `SELECT id, name, share_token, pin_position, last_edited FROM projects WHERE user_id = ? AND deleted_at IS NULL ${searchClause} ORDER BY (pin_position IS NULL) ASC, pin_position ASC, created_at DESC LIMIT ? OFFSET ?`,
    params: [userId, ...searchParam, pageSize, offset],
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
      sql: `SELECT id, project_id, name, value, unit, brush_name, opacity FROM project_brush_norms WHERE project_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY project_id ASC, position ASC, id ASC`,
      params: projectIds,
    }),
    runTimedQuery({
      label: 'project_typography_norms',
      sql: `SELECT id, project_id, font_family, font_weight, font_usage, font_style FROM project_typography_norms WHERE project_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY project_id ASC, position ASC, id ASC`,
      params: projectIds,
    }),
    runTimedQuery({
      label: 'project_palette',
      sql: `SELECT id, project_id, name, hex FROM project_palette WHERE project_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY project_id ASC, position ASC, id ASC`,
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
      // ISO timestamp, formatted client-side in the viewer's own timezone
      // (see frontend/src/utils/date.js) rather than baked into the SQL layer.
      lastEdited: project.last_edited ? new Date(project.last_edited).toISOString() : 'Just now',
      shareToken: project.share_token || null,
      pinned: project.pin_position !== null,
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

// Cap on matches returned per category by the global search, and the upper
// bound on the search term (defense against absurdly long LIKE patterns).
const SEARCH_RESULTS_PER_TYPE = 5;
const SEARCH_QUERY_MAX_LENGTH = 100;

// Global search (Ctrl+K) across the user's project names, palette colors
// (name or hex, '#' optional) and brush/typography standards. Every query is
// scoped to the owner and to live rows — the search can never surface another
// user's content — and LIKE wildcards in the term are escaped. Throws
// 'validation' for a blank or over-long query. SEARCH_RESULTS_PER_TYPE is an
// internal constant, never user input, so interpolating it into LIMIT is safe.
const searchProjectContentForUser = async (userId, rawQuery) => {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query || query.length > SEARCH_QUERY_MAX_LENGTH) {
    throw new ProjectServiceError(
      'validation',
      `Search query must be 1-${SEARCH_QUERY_MAX_LENGTH} characters.`,
    );
  }
  const like = `%${escapeLikeWildcards(query)}%`;
  const hexLike = `%${escapeLikeWildcards(query.replace(/^#/, ''))}%`;

  const [[projectRows], [colorRows], [brushRows], [typographyRows]] = await Promise.all([
    db.query(
      `SELECT id, name FROM projects WHERE user_id = ? AND deleted_at IS NULL AND name LIKE ? ORDER BY name ASC LIMIT ${SEARCH_RESULTS_PER_TYPE}`,
      [userId, like],
    ),
    db.query(
      `SELECT c.id, c.name, c.hex, c.project_id, p.name AS project_name
       FROM project_palette c JOIN projects p ON p.id = c.project_id
       WHERE p.user_id = ? AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND (c.name LIKE ? OR c.hex LIKE ?)
       ORDER BY c.name ASC LIMIT ${SEARCH_RESULTS_PER_TYPE}`,
      [userId, like, hexLike],
    ),
    db.query(
      `SELECT b.id, b.name, b.brush_name, b.project_id, p.name AS project_name
       FROM project_brush_norms b JOIN projects p ON p.id = b.project_id
       WHERE p.user_id = ? AND p.deleted_at IS NULL AND b.deleted_at IS NULL AND (b.name LIKE ? OR b.brush_name LIKE ?)
       ORDER BY b.name ASC LIMIT ${SEARCH_RESULTS_PER_TYPE}`,
      [userId, like, like],
    ),
    db.query(
      `SELECT t.id, t.font_family, t.font_usage, t.project_id, p.name AS project_name
       FROM project_typography_norms t JOIN projects p ON p.id = t.project_id
       WHERE p.user_id = ? AND p.deleted_at IS NULL AND t.deleted_at IS NULL AND (t.font_family LIKE ? OR t.font_usage LIKE ?)
       ORDER BY t.font_family ASC LIMIT ${SEARCH_RESULTS_PER_TYPE}`,
      [userId, like, like],
    ),
  ]);

  return {
    projects: projectRows.map((row) => ({ id: row.id, name: row.name })),
    colors: colorRows.map((row) => ({
      id: row.id,
      name: row.name,
      hex: row.hex,
      projectId: row.project_id,
      projectName: row.project_name,
    })),
    brushNorms: brushRows.map((row) => ({
      id: row.id,
      name: row.name,
      brushName: row.brush_name,
      projectId: row.project_id,
      projectName: row.project_name,
    })),
    typographyNorms: typographyRows.map((row) => ({
      id: row.id,
      fontFamily: row.font_family,
      fontUsage: row.font_usage,
      projectId: row.project_id,
      projectName: row.project_name,
    })),
  };
};

// The one project-name rule, shared by creation and rename so the two can
// never drift apart: a non-blank string whose trimmed length is 2-50 chars.
// Returns the trimmed name; throws 'missing_name' (absent/blank/non-string)
// or 'invalid_name' (length out of range).
const validateProjectName = (rawName) => {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    throw new ProjectServiceError('missing_name');
  }
  const name = validator.trim(rawName);
  if (!validator.isLength(name, { min: 2, max: 50 })) {
    throw new ProjectServiceError('invalid_name');
  }
  return name;
};

// Creates an empty project after validating the name. Throws 'missing_name' or
// 'invalid_name' (see validateProjectName).
const createProjectForUser = async (userId, rawName) => {
  const name = validateProjectName(rawName);

  const [result] = await db.query('INSERT INTO projects (user_id, name) VALUES (?, ?)', [
    userId,
    name,
  ]);
  const newId = result.insertId;

  return {
    id: newId,
    name,
    lastEdited: 'Just now',
    shareToken: null,
    pinned: false,
    normsCount: 0,
    norms: [],
    palette: [],
  };
};

// Duplicates a project the user owns: copies the project row (name suffixed
// with " (copy)", capped at the shared 50-char limit) and all of its brush
// norms, typography norms and palette colors. The copies run in a transaction
// so a half-duplicated project can never be left behind. Throws 'not_found'
// when the project doesn't exist or belongs to someone else.
const duplicateProjectForUser = async (userId, projectId) => {
  const [rows] = await db.query(
    'SELECT name FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [projectId, userId],
  );
  if (rows.length === 0) {
    throw new ProjectServiceError('not_found');
  }

  const suffix = ' (copy)';
  const name = rows[0].name.slice(0, 50 - suffix.length) + suffix;

  const connection = await db.getConnection();
  let newProjectId;
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      'INSERT INTO projects (user_id, name) VALUES (?, ?)',
      [userId, name],
    );
    newProjectId = insertResult.insertId;

    // Trashed colors/standards are excluded: duplicating a project should not
    // resurrect something its owner already threw away. Their manual order
    // (position) carries over so the copy looks identical to the source.
    await connection.query(
      'INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name, opacity, position) SELECT ?, name, value, unit, brush_name, opacity, position FROM project_brush_norms WHERE project_id = ? AND deleted_at IS NULL',
      [newProjectId, projectId],
    );
    await connection.query(
      'INSERT INTO project_typography_norms (project_id, font_family, font_weight, font_usage, font_style, position) SELECT ?, font_family, font_weight, font_usage, font_style, position FROM project_typography_norms WHERE project_id = ? AND deleted_at IS NULL',
      [newProjectId, projectId],
    );
    await connection.query(
      'INSERT INTO project_palette (project_id, name, hex, position) SELECT ?, name, hex, position FROM project_palette WHERE project_id = ? AND deleted_at IS NULL',
      [newProjectId, projectId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // Read the copies back so the response carries the new server-assigned ids,
  // in the same shape as a listProjectsForUser item.
  const [brushRows] = await db.query(
    'SELECT id, name, value, unit, brush_name, opacity FROM project_brush_norms WHERE project_id = ? ORDER BY position ASC, id ASC',
    [newProjectId],
  );
  const [typographyRows] = await db.query(
    'SELECT id, font_family, font_weight, font_usage, font_style FROM project_typography_norms WHERE project_id = ? ORDER BY position ASC, id ASC',
    [newProjectId],
  );
  const [paletteRows] = await db.query(
    'SELECT id, name, hex FROM project_palette WHERE project_id = ? ORDER BY position ASC, id ASC',
    [newProjectId],
  );

  const brushNorms = brushRows.map((norm) => ({
    id: norm.id,
    name: norm.name,
    value: norm.value,
    unit: norm.unit,
    brushName: norm.brush_name,
    opacity: norm.opacity,
  }));
  const typographyNorms = typographyRows.map((norm) => ({
    id: norm.id,
    fontFamily: norm.font_family,
    fontWeight: norm.font_weight,
    fontUsage: norm.font_usage,
    fontStyle: norm.font_style,
  }));
  const palette = paletteRows.map((color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
  }));

  return {
    id: newProjectId,
    name,
    lastEdited: 'Just now',
    shareToken: null,
    pinned: false,
    brushNorms,
    typographyNorms,
    normsCount: brushNorms.length + typographyNorms.length,
    palette,
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

// Fetches one of the user's projects by id, in the exact shape of a
// listProjectsForUser item. The paginated list stays the primary source; this
// exists so a deep link / hard reload on a project beyond the loaded pages can
// resolve it directly instead of wrongly concluding "not found". Scoped to the
// owner and to live projects; throws 'not_found' otherwise.
const getProjectByIdForUser = async (userId, projectId) => {
  const [rows] = await db.query(
    'SELECT id, name, share_token, pin_position, last_edited FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [projectId, userId],
  );
  if (rows.length === 0) {
    throw new ProjectServiceError('not_found');
  }
  const project = rows[0];

  const { brushNorms, typographyNorms, palette } = await fetchLiveProjectChildren(project.id);

  return {
    id: project.id,
    name: project.name,
    // ISO timestamp, formatted client-side in the viewer's own timezone
    // (see frontend/src/utils/date.js) rather than baked into the SQL layer.
    lastEdited: project.last_edited ? new Date(project.last_edited).toISOString() : 'Just now',
    shareToken: project.share_token || null,
    pinned: project.pin_position !== null,
    brushNorms,
    typographyNorms,
    normsCount: brushNorms.length + typographyNorms.length,
    palette,
  };
};

// Adds a brush norm after validation, appended after the project's current
// last-position norm, then touches last_edited. Throws 'validation' (with the
// user-facing message) on an invalid payload.
const addBrushNormToProject = async (projectId, payload) => {
  const validatedBrushNorm = validateBrushNormPayload(payload);
  if (validatedBrushNorm.error) {
    throw new ProjectServiceError('validation', validatedBrushNorm.error);
  }

  const [result] = await db.query(
    `INSERT INTO project_brush_norms (project_id, name, value, unit, brush_name, opacity, position)
     SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(position), -1) + 1
     FROM project_brush_norms WHERE project_id = ? AND deleted_at IS NULL`,
    [
      projectId,
      validatedBrushNorm.value.name,
      validatedBrushNorm.value.value,
      validatedBrushNorm.value.unit,
      validatedBrushNorm.value.brushName,
      validatedBrushNorm.value.opacity,
      projectId,
    ],
  );
  await db.query('UPDATE projects SET last_edited = NOW() WHERE id = ?', [projectId]);
  return { success: true, id: result.insertId };
};

// Adds a typography norm after validation, appended after the project's
// current last-position norm, then touches last_edited. Throws 'validation'
// on an invalid payload.
const addTypographyNormToProject = async (projectId, payload) => {
  const validatedTypographyNorm = validateTypographyNormPayload(payload);
  if (validatedTypographyNorm.error) {
    throw new ProjectServiceError('validation', validatedTypographyNorm.error);
  }

  const [result] = await db.query(
    `INSERT INTO project_typography_norms (project_id, font_family, font_weight, font_usage, font_style, position)
     SELECT ?, ?, ?, ?, ?, COALESCE(MAX(position), -1) + 1
     FROM project_typography_norms WHERE project_id = ? AND deleted_at IS NULL`,
    [
      projectId,
      validatedTypographyNorm.value.fontFamily,
      validatedTypographyNorm.value.fontWeight,
      validatedTypographyNorm.value.fontUsage,
      validatedTypographyNorm.value.fontStyle,
      projectId,
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
      throw new ProjectServiceError('validation', 'The color usage is invalid.');
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

// Validates a reorder payload: a non-empty array of positive integer ids
// (capped generously — no real list ever gets close to this). Returns the
// parsed ids or throws 'validation'.
const validateOrderedIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ProjectServiceError('validation', 'A non-empty list of ids is required.');
  }
  if (ids.length > 500) {
    throw new ProjectServiceError('validation', 'Too many ids in the reorder list.');
  }
  const parsedIds = ids.map((id) => Number(id));
  if (parsedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new ProjectServiceError('validation', 'Invalid id in the reorder list.');
  }
  return parsedIds;
};

// Reorders a project's child rows (brush norms or typography norms) to match
// the given id sequence — the same "array order becomes persisted position"
// contract as replaceProjectPalette, but reorder-only (no add/edit/remove).
// Ids that don't belong to this project (or are trashed) are silently
// skipped, so a stale client array can't corrupt another project's ordering.
// A single UPDATE ... CASE assigns every row's new position atomically
// (no transaction needed — one statement can't leave a partial reorder behind).
const reorderChildRows = async (table, projectId, orderedIds) => {
  const caseClauses = orderedIds.map(() => 'WHEN ? THEN ?').join(' ');
  const caseParams = orderedIds.flatMap((id, position) => [id, position]);
  const idPlaceholders = orderedIds.map(() => '?').join(', ');

  await db.query(
    `UPDATE ${table} SET position = CASE id ${caseClauses} ELSE position END
     WHERE project_id = ? AND deleted_at IS NULL AND id IN (${idPlaceholders})`,
    [...caseParams, projectId, ...orderedIds],
  );

  return { success: true };
};

// Reorders a project's brush standards. Throws 'validation' on a bad payload.
const reorderBrushNormsForProject = (projectId, ids) =>
  reorderChildRows(TRASHABLE_CHILD_TABLES.brushNorm, projectId, validateOrderedIds(ids));

// Reorders a project's typography standards. Throws 'validation' on a bad payload.
const reorderTypographyNormsForProject = (projectId, ids) =>
  reorderChildRows(TRASHABLE_CHILD_TABLES.typographyNorm, projectId, validateOrderedIds(ids));

// Pins a project to the top of the dashboard, appended after the user's
// current last-pinned project. Idempotent: re-pinning an already-pinned
// project leaves its position untouched (COALESCE). Scoped to the owner and
// to live projects, which doubles as the ownership check. Rank lookup and
// update run in one transaction with FOR UPDATE, so two concurrent pins
// serialize instead of both reading the same next position.
const pinProjectForUser = async (userId, projectId) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rankRows] = await connection.query(
      'SELECT COALESCE(MAX(pin_position), -1) + 1 AS next_position FROM projects WHERE user_id = ? AND pin_position IS NOT NULL FOR UPDATE',
      [userId],
    );
    const nextPosition = rankRows[0]?.next_position ?? 0;
    const [result] = await connection.query(
      'UPDATE projects SET pin_position = COALESCE(pin_position, ?) WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [nextPosition, projectId, userId],
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Unpins a project. Returns false when nothing matched (wrong owner, trashed,
// or doesn't exist) so the controller can 404.
const unpinProjectForUser = async (userId, projectId) => {
  const [result] = await db.query(
    'UPDATE projects SET pin_position = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [projectId, userId],
  );
  return result.affectedRows > 0;
};

// Reorders the user's pinned projects to match the given id sequence. Ids
// that aren't currently pinned by this user are silently skipped. Throws
// 'validation' on a bad payload. A single UPDATE ... CASE assigns every
// project's new pin_position atomically, same approach as reorderChildRows.
const reorderPinnedProjectsForUser = async (userId, ids) => {
  const orderedIds = validateOrderedIds(ids);
  const caseClauses = orderedIds.map(() => 'WHEN ? THEN ?').join(' ');
  const caseParams = orderedIds.flatMap((id, position) => [id, position]);
  const idPlaceholders = orderedIds.map(() => '?').join(', ');

  await db.query(
    `UPDATE projects SET pin_position = CASE id ${caseClauses} ELSE pin_position END
     WHERE user_id = ? AND deleted_at IS NULL AND pin_position IS NOT NULL AND id IN (${idPlaceholders})`,
    [...caseParams, userId, ...orderedIds],
  );

  return { success: true };
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

    // Ids that currently belong to this project (excluding already-trashed
    // ones — a trashed color can only come back via the dedicated restore
    // endpoint, never by resurfacing in a bulk save), used both to detect
    // removals and to ensure a client-supplied id can't target another
    // project's color.
    const [existingRows] = await connection.query(
      'SELECT id FROM project_palette WHERE project_id = ? AND deleted_at IS NULL',
      [projectId],
    );
    const existingIds = new Set(existingRows.map((row) => row.id));

    // Keep only the ids the client sent that actually belong to this project.
    const keptIds = validatedColors
      .filter((color) => color.id !== null && existingIds.has(color.id))
      .map((color) => color.id);

    // Soft-delete the colors that are no longer present in the new palette,
    // so they're restorable from the trash instead of gone for good.
    if (keptIds.length > 0) {
      const placeholders = keptIds.map(() => '?').join(', ');
      await connection.query(
        `UPDATE project_palette SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL AND id NOT IN (${placeholders})`,
        [projectId, ...keptIds],
      );
    } else {
      await connection.query(
        'UPDATE project_palette SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
    }

    // Upsert each color at its array index, which becomes its persisted position.
    for (let position = 0; position < validatedColors.length; position += 1) {
      const color = validatedColors[position];
      if (color.id !== null && existingIds.has(color.id)) {
        await connection.query(
          'UPDATE project_palette SET name = ?, hex = ?, position = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
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
      'SELECT id, name, hex FROM project_palette WHERE project_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
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

// Updates a brush norm after validation, scoped by norm id and project id;
// refreshes last_edited. A trashed norm can't be edited directly (restore it
// first). Throws 'validation' on a bad payload, 'not_found' when no row matched.
const updateBrushNormInProject = async (projectId, normId, payload) => {
  const validatedBrushNorm = validateBrushNormPayload(payload);
  if (validatedBrushNorm.error) {
    throw new ProjectServiceError('validation', validatedBrushNorm.error);
  }

  const [result] = await db.query(
    'UPDATE project_brush_norms SET name = ?, value = ?, unit = ?, brush_name = ?, opacity = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
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
// refreshes last_edited. A trashed norm can't be edited directly (restore it
// first). Throws 'validation' on a bad payload, 'not_found' when no row matched.
const updateTypographyNormInProject = async (projectId, normId, payload) => {
  const validatedTypographyNorm = validateTypographyNormPayload(payload);
  if (validatedTypographyNorm.error) {
    throw new ProjectServiceError('validation', validatedTypographyNorm.error);
  }

  const [result] = await db.query(
    'UPDATE project_typography_norms SET font_family = ?, font_weight = ?, font_usage = ?, font_style = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
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
  escapeLikeWildcards,
  validateProjectName,
  searchProjectContentForUser,
  userOwnsProject,
  listProjectsForUser,
  getProjectByIdForUser,
  createProjectForUser,
  duplicateProjectForUser,
  renameProject,
  deleteProjectById,
  listTrashedProjectsForUser,
  restoreProjectForUser,
  deleteProjectPermanently,
  purgeExpiredTrashedProjects,
  purgeExpiredTrashedProjectItems,
  enableProjectSharing,
  disableProjectSharing,
  getSharedProjectByToken,
  TRASH_RETENTION_DAYS,
  addBrushNormToProject,
  addTypographyNormToProject,
  validatePalettePayload,
  replaceProjectPalette,
  deleteBrushNormFromProject,
  restoreBrushNormInProject,
  deleteBrushNormPermanently,
  listTrashedBrushNormsForProject,
  deleteTypographyNormFromProject,
  restoreTypographyNormInProject,
  deleteTypographyNormPermanently,
  listTrashedTypographyNormsForProject,
  deletePaletteColorFromProject,
  restorePaletteColorInProject,
  deletePaletteColorPermanently,
  listTrashedPaletteColorsForProject,
  updateBrushNormInProject,
  updateTypographyNormInProject,
  reorderBrushNormsForProject,
  reorderTypographyNormsForProject,
  pinProjectForUser,
  unpinProjectForUser,
  reorderPinnedProjectsForUser,
};
