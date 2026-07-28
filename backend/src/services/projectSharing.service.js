/**
 * Public sharing of a project's reference sheet: minting/revoking the share
 * token and the unauthenticated shared read. Also home of
 * fetchLiveProjectChildren, the content reader both the owner's single-project
 * read and the public share read return verbatim. Split out of
 * projects.service.js (which re-exports everything here).
 */

const { randomBytes } = require('crypto');
const db = require('../database');
const { ProjectServiceError } = require('./projects.errors');

// Reads a project's live (non-trashed) children in display order and maps them
// to the API's camelCase shapes. Shared by the single-project read and the
// public share read, which return the exact same content.
const fetchLiveProjectChildren = async (projectId) => {
  const [brushRows] = await db.query(
    'SELECT id, name, value, unit, brush_name, opacity FROM project_brush_norms WHERE project_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
    [projectId],
  );
  const [typographyRows] = await db.query(
    'SELECT id, font_family, font_weight, font_usage, font_style FROM project_typography_norms WHERE project_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
    [projectId],
  );
  const [paletteRows] = await db.query(
    'SELECT id, name, hex FROM project_palette WHERE project_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
    [projectId],
  );

  return {
    brushNorms: brushRows.map((norm) => ({
      id: norm.id,
      name: norm.name,
      value: norm.value,
      unit: norm.unit,
      brushName: norm.brush_name,
      opacity: norm.opacity,
    })),
    typographyNorms: typographyRows.map((norm) => ({
      id: norm.id,
      fontFamily: norm.font_family,
      fontWeight: norm.font_weight,
      fontUsage: norm.font_usage,
      fontStyle: norm.font_style,
    })),
    palette: paletteRows.map((color) => ({
      id: color.id,
      name: color.name,
      hex: color.hex,
    })),
  };
};

// Shape of a valid share token: 32 hex chars (128 random bits). Checked before
// querying so junk input never reaches the database.
const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

// Enables public sharing for a project: mints an unguessable token on first
// call and keeps the existing one afterwards (idempotent — re-enabling never
// silently changes a link that may already be in someone's hands).
const enableProjectSharing = async (projectId) => {
  const candidateToken = randomBytes(16).toString('hex');
  await db.query('UPDATE projects SET share_token = COALESCE(share_token, ?) WHERE id = ?', [
    candidateToken,
    projectId,
  ]);
  const [rows] = await db.query('SELECT share_token FROM projects WHERE id = ?', [projectId]);
  return { shareToken: rows[0]?.share_token || candidateToken };
};

// Disables public sharing: the link stops working immediately. Re-enabling
// later mints a brand-new token, so an old revoked link never comes back.
const disableProjectSharing = async (projectId) => {
  await db.query('UPDATE projects SET share_token = NULL WHERE id = ?', [projectId]);
  return { success: true };
};

// Public, unauthenticated read of a shared project: the reference-sheet
// content (name, norms, palette) plus the owner's display name for a "Made by"
// credit — never their id, email, or the project's own id. Trashed projects
// don't resolve. Throws 'not_found' for any invalid/unknown token.
const getSharedProjectByToken = async (rawToken) => {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!SHARE_TOKEN_PATTERN.test(token)) {
    throw new ProjectServiceError('not_found');
  }

  // Joins the owner's display name only (never their email or id) — a small,
  // deliberate exception to "never expose the owner": a "Made by <name>" credit
  // on a public reference sheet, nothing that could be used to contact them.
  const [rows] = await db.query(
    `SELECT projects.id, projects.name, users.name AS owner_name
     FROM projects
     JOIN users ON users.id = projects.user_id
     WHERE projects.share_token = ? AND projects.deleted_at IS NULL`,
    [token],
  );
  if (rows.length === 0) {
    throw new ProjectServiceError('not_found');
  }
  const { brushNorms, typographyNorms, palette } = await fetchLiveProjectChildren(rows[0].id);

  return {
    name: rows[0].name,
    ownerName: rows[0].owner_name,
    brushNorms,
    typographyNorms,
    palette,
  };
};

module.exports = {
  fetchLiveProjectChildren,
  enableProjectSharing,
  disableProjectSharing,
  getSharedProjectByToken,
};
