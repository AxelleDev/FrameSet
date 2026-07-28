/**
 * Project trash lifecycle: soft delete, restore, permanent delete and the
 * scheduled purges — for projects and for their colors/standards. Split out of
 * projects.service.js (which re-exports everything here, so the controller
 * keeps a single import surface).
 */

const db = require('../database');
const { ProjectServiceError } = require('./projects.errors');

// How long a trashed project (or one of its colors/standards) stays restorable
// before the scheduled purge drops it.
const TRASH_RETENTION_DAYS = 30;

// Child tables that support the same per-row trash lifecycle as projects
// (soft-delete, restore, permanent delete, purge), each scoped to project_id.
// Not user input — always one of these three literals — so interpolating the
// table name into SQL below is safe.
const TRASHABLE_CHILD_TABLES = {
  palette: 'project_palette',
  brushNorm: 'project_brush_norms',
  typographyNorm: 'project_typography_norms',
};

// Soft-deletes a single row of a project's child table (a color, brush norm or
// typography norm), scoped to the project so one project can't reach into
// another's row. Returns false when nothing matched (wrong project, already
// trashed, or never existed).
const softDeleteChildRow = async (table, projectId, rowId) => {
  const [result] = await db.query(
    `UPDATE ${table} SET deleted_at = NOW() WHERE id = ? AND project_id = ? AND deleted_at IS NULL`,
    [rowId, projectId],
  );
  return result.affectedRows > 0;
};

// Restores a trashed child row. The UPDATE is scoped to trashed rows only, so
// it doubles as both the "is it actually trashed" and ownership-adjacent check.
const restoreChildRow = async (table, projectId, rowId) => {
  const [result] = await db.query(
    `UPDATE ${table} SET deleted_at = NULL WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL`,
    [rowId, projectId],
  );
  return result.affectedRows > 0;
};

// Permanently deletes a TRASHED child row; irreversible. Only reachable from
// the trash (the WHERE clause requires deleted_at IS NOT NULL), so a live row
// can never be hard-deleted in one step.
const deleteChildRowPermanently = async (table, projectId, rowId) => {
  const [result] = await db.query(
    `DELETE FROM ${table} WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL`,
    [rowId, projectId],
  );
  return result.affectedRows > 0;
};

// Drops a child table's trashed rows past the retention window. Run by the
// daily cleanup scheduler alongside the project purge; returns false instead
// of throwing so a failed purge only logs a warning.
const purgeExpiredTrashedChildRows = async (table) => {
  try {
    await db.query(
      `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [TRASH_RETENTION_DAYS],
    );
    return true;
  } catch (error) {
    return false;
  }
};

// Moves a project to the trash (soft delete): it disappears from the dashboard
// but stays restorable for TRASH_RETENTION_DAYS before the scheduled purge
// drops it for good.
const deleteProjectById = async (projectId) => {
  await db.query('UPDATE projects SET deleted_at = NOW() WHERE id = ?', [projectId]);
  return { success: true };
};

// Lists the user's trashed projects (newest first), with how many days each one
// has left before the purge removes it.
const listTrashedProjectsForUser = async (userId) => {
  const [rows] = await db.query(
    'SELECT id, name, deleted_at, GREATEST(0, ? - DATEDIFF(NOW(), deleted_at)) AS days_left FROM projects WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    [TRASH_RETENTION_DAYS, userId],
  );

  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    deletedAt: project.deleted_at,
    daysLeft: Number(project.days_left),
  }));
};

// Restores a trashed project. The UPDATE is scoped to the owner and to trashed
// rows, so it doubles as the ownership check. Throws 'not_found' when nothing
// matched (wrong owner, already restored, or purged).
const restoreProjectForUser = async (userId, projectId) => {
  const [result] = await db.query(
    'UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
    [projectId, userId],
  );
  if (result.affectedRows === 0) {
    throw new ProjectServiceError('not_found');
  }
  return { success: true };
};

// Permanently deletes a TRASHED project (children cascade). Only reachable from
// the trash, so a live project can never be hard-deleted in one step. The DELETE
// is owner- and trash-scoped; throws 'not_found' when nothing matched.
const deleteProjectPermanently = async (userId, projectId) => {
  const [result] = await db.query(
    'DELETE FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
    [projectId, userId],
  );
  if (result.affectedRows === 0) {
    throw new ProjectServiceError('not_found');
  }
  return { success: true };
};

// Drops trashed projects past the retention window; children cascade. Run by
// the daily cleanup scheduler (same pattern as the revoked-token purge).
// Returns false instead of throwing so a failed purge only logs a warning.
const purgeExpiredTrashedProjects = async () => {
  try {
    await db.query(
      'DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [TRASH_RETENTION_DAYS],
    );
    return true;
  } catch (error) {
    return false;
  }
};

// Drops trashed colors/standards past the retention window, for rows whose
// PROJECT is still live (a trashed project's children already cascade away
// when the project itself is purged above). Returns false if any of the three
// purges failed, so the caller only logs a warning.
const purgeExpiredTrashedProjectItems = async () => {
  const results = await Promise.all([
    purgeExpiredTrashedChildRows(TRASHABLE_CHILD_TABLES.palette),
    purgeExpiredTrashedChildRows(TRASHABLE_CHILD_TABLES.brushNorm),
    purgeExpiredTrashedChildRows(TRASHABLE_CHILD_TABLES.typographyNorm),
  ]);
  return results.every(Boolean);
};

// Moves a brush norm to the trash (soft delete), scoped by both norm id and
// project id (defense in depth beyond the ownership check). Restorable for
// TRASH_RETENTION_DAYS. Returns false when no (non-trashed) row matched.
const deleteBrushNormFromProject = (projectId, normId) =>
  softDeleteChildRow(TRASHABLE_CHILD_TABLES.brushNorm, projectId, normId);

// Moves a typography norm to the trash (soft delete), scoped by norm id and
// project id. Returns false when no (non-trashed) row matched.
const deleteTypographyNormFromProject = (projectId, normId) =>
  softDeleteChildRow(TRASHABLE_CHILD_TABLES.typographyNorm, projectId, normId);

// Restores a trashed brush norm. Returns false when nothing matched (wrong
// project, already restored, or purged).
const restoreBrushNormInProject = (projectId, normId) =>
  restoreChildRow(TRASHABLE_CHILD_TABLES.brushNorm, projectId, normId);

// Restores a trashed typography norm. Returns false when nothing matched.
const restoreTypographyNormInProject = (projectId, normId) =>
  restoreChildRow(TRASHABLE_CHILD_TABLES.typographyNorm, projectId, normId);

// Permanently deletes a TRASHED brush norm; irreversible. Returns false when
// nothing matched (not trashed, wrong project, or already purged).
const deleteBrushNormPermanently = (projectId, normId) =>
  deleteChildRowPermanently(TRASHABLE_CHILD_TABLES.brushNorm, projectId, normId);

// Permanently deletes a TRASHED typography norm; irreversible.
const deleteTypographyNormPermanently = (projectId, normId) =>
  deleteChildRowPermanently(TRASHABLE_CHILD_TABLES.typographyNorm, projectId, normId);

// Lists a project's trashed brush norms (newest first), with days left before purge.
const listTrashedBrushNormsForProject = async (projectId) => {
  const [rows] = await db.query(
    'SELECT id, name, value, unit, brush_name, opacity, deleted_at, GREATEST(0, ? - DATEDIFF(NOW(), deleted_at)) AS days_left FROM project_brush_norms WHERE project_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    [TRASH_RETENTION_DAYS, projectId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    value: row.value,
    unit: row.unit,
    brushName: row.brush_name,
    opacity: row.opacity,
    deletedAt: row.deleted_at,
    daysLeft: Number(row.days_left),
  }));
};

// Lists a project's trashed typography norms (newest first), with days left before purge.
const listTrashedTypographyNormsForProject = async (projectId) => {
  const [rows] = await db.query(
    'SELECT id, font_family, font_weight, font_usage, font_style, deleted_at, GREATEST(0, ? - DATEDIFF(NOW(), deleted_at)) AS days_left FROM project_typography_norms WHERE project_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    [TRASH_RETENTION_DAYS, projectId],
  );
  return rows.map((row) => ({
    id: row.id,
    fontFamily: row.font_family,
    fontWeight: row.font_weight,
    fontUsage: row.font_usage,
    fontStyle: row.font_style,
    deletedAt: row.deleted_at,
    daysLeft: Number(row.days_left),
  }));
};

// Moves a palette color to the trash (soft delete), scoped by color id and
// project id. Returns false when no (non-trashed) row matched.
const deletePaletteColorFromProject = (projectId, colorId) =>
  softDeleteChildRow(TRASHABLE_CHILD_TABLES.palette, projectId, colorId);

// Restores a trashed palette color. Returns false when nothing matched.
const restorePaletteColorInProject = (projectId, colorId) =>
  restoreChildRow(TRASHABLE_CHILD_TABLES.palette, projectId, colorId);

// Permanently deletes a TRASHED palette color; irreversible.
const deletePaletteColorPermanently = (projectId, colorId) =>
  deleteChildRowPermanently(TRASHABLE_CHILD_TABLES.palette, projectId, colorId);

// Lists a project's trashed palette colors (newest first), with days left before purge.
const listTrashedPaletteColorsForProject = async (projectId) => {
  const [rows] = await db.query(
    'SELECT id, name, hex, deleted_at, GREATEST(0, ? - DATEDIFF(NOW(), deleted_at)) AS days_left FROM project_palette WHERE project_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    [TRASH_RETENTION_DAYS, projectId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hex: row.hex,
    deletedAt: row.deleted_at,
    daysLeft: Number(row.days_left),
  }));
};

module.exports = {
  TRASH_RETENTION_DAYS,
  // The child-table map is also the reorder helpers' whitelist (see
  // projects.service.js) — same tables, same "never user input" guarantee.
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
};
