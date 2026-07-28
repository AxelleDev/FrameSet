/**
 * Frontend-side mirrors of backend business rules. The backend is always the
 * source of truth and enforces every one of these independently — nothing
 * here relaxes or replaces server-side validation. This file exists only so
 * that changing one of these rules is "these two files", not "grep the
 * codebase for a magic number and hope nothing was missed".
 */

// Mirrors MAX_PALETTE_SIZE in backend/src/services/projects.service.js.
export const MAX_PALETTE_SIZE = 50;

// Mirrors the max length enforced by validateProjectName in
// backend/src/services/projects.service.js (also the min, 2 chars, which the
// frontend does not pre-validate — only the max is needed client-side, to
// truncate a demo-simulated project/color/standard duplicate's "(copy)" name
// the same way the server would).
export const PROJECT_NAME_MAX_LENGTH = 50;

// Mirrors the " (copy)" suffix backend/src/services/projects.service.js
// appends when duplicating a whole project.
export const PROJECT_DUPLICATE_SUFFIX = ' (copy)';

// Mirrors REFRESH_TOKEN_MAX_AGE_MS in backend/src/utils/cookies.utils.js: the
// refresh-token cookie's lifetime, i.e. the real "you'll be signed out"
// boundary (every successful refresh rotates the token and slides this
// window forward). Used to estimate when to show the session-expiry warning.
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Mirrors the demo account's seeded project share token in
// backend/migrations/019_add_demo_account.sql.
export const DEMO_SHARE_TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
