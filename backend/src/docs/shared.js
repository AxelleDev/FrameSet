// Building blocks shared by every path module in ./paths.

// Reusable security requirement for authenticated endpoints (cookie OR bearer).
const AUTH = [{ cookieAuth: [] }, { bearerAuth: [] }];
// Reusable CSRF header for mutating requests (double-submit cookie pattern).
const CSRF_HEADER = { $ref: '#/components/parameters/CsrfToken' };

module.exports = { AUTH, CSRF_HEADER };
