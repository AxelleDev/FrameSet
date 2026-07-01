/**
 * Authentication controller.
 *
 * Thin HTTP layer for the auth lifecycle: registration with email verification,
 * login, access/refresh token issuance via httpOnly cookies, refresh-token
 * rotation with revocation, email verification and code resend, CSRF token
 * issuance, and logout (which revokes the presented tokens). Business logic and
 * SQL live in auth.service; this layer parses the request, issues/clears tokens
 * and cookies, logs outcomes (with privacy-preserving email fingerprints rather
 * than raw addresses), and maps results/typed service errors to HTTP responses.
 */

const { randomBytes } = require('crypto');
const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const { getIdentifierFingerprint } = require('../utils/auth.utils');
const { generateRefreshToken, verifyRefreshToken, revokeToken, isTokenRevoked } = require('../services/token.service');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt.config');
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCsrfTokenCookieOptions,
  getCookieBaseOptions,
  getCookieValue
} = require('../utils/cookies.utils');
const { logger } = require('../utils/logger');

/**
 * Sets the access and refresh tokens as httpOnly cookies on the response so the
 * browser stores credentials inaccessible to JavaScript (XSS mitigation).
 * @param {Object} res Express response.
 * @param {string} accessToken Signed access JWT.
 * @param {string} refreshToken Signed refresh JWT.
 */
const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getAccessTokenCookieOptions());
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
};

/**
 * Clears the auth cookies, using the same base options they were set with so
 * the browser reliably removes them (path/flags must match).
 * @param {Object} res Express response.
 */
const clearAuthCookies = (res) => {
  const cookieOptions = getCookieBaseOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions);
};

/** Extracts a Bearer token from the Authorization header, or null. */
const getBearerToken = (req) => {
  const authHeader = req?.headers?.authorization;
  return authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
};

/** Resolves the access token from the Authorization header or the cookie. */
const getAccessTokenFromRequest = (req) => getBearerToken(req) || getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);

/**
 * Verifies an access token, returning the decoded payload or null on failure.
 * ignoreExpiration is used during logout so an expired-but-valid token can
 * still be identified and revoked.
 * @param {string} token Raw access JWT.
 * @param {{ignoreExpiration?: boolean}} [options]
 * @returns {Object|null}
 */
const verifyAccessToken = (token, { ignoreExpiration = false } = {}) => {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET, { ignoreExpiration });
  } catch (error) {
    return null;
  }
};

/**
 * Signs a short-lived access token carrying the minimal identity claims.
 * @param {{id:number, email:string}} user
 * @returns {string} Signed access JWT.
 */
const createAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

/** Generates a 256-bit random CSRF token. */
const createCsrfToken = () => randomBytes(32).toString('hex');

/**
 * Issues (or reuses) the CSRF token used by the double-submit cookie pattern.
 * Reuses the existing cookie token when present so the cookie and the returned
 * value stay in sync; otherwise mints and sets a new one. The token is returned
 * in the body so the SPA can attach it to the x-csrf-token header.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const getCsrfToken = (req, res) => {
  const existingCsrfToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);
  const csrfToken = existingCsrfToken || createCsrfToken();

  res.cookie(CSRF_TOKEN_COOKIE_NAME, csrfToken, getCsrfTokenCookieOptions());
  return res.json({ csrfToken });
};

/**
 * Registers a new user. Delegates validation, hashing, persistence and the
 * confirmation email to the service. A duplicate-email error is logged but
 * surfaced with a generic message to avoid leaking which emails exist.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const register = async (req, res) => {
  const body = req.body || {};
  try {
    const { user } = await authService.registerUser(body);
    res.json({ success: true, ...user });
  } catch (error) {
    const email = body.email;
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'duplicate_email') {
      logger.warn('auth.register.duplicate_email', {
        requestId: req.id,
        emailFingerprint: getIdentifierFingerprint(email)
      });
      return res.status(400).json({ error: 'Something went wrong during sign-up.' });
    }

    logger.error('auth.register.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Authenticates a user with email and password. Delegates credential checking
 * to the service; on success issues access and refresh tokens as httpOnly
 * cookies. Identical generic error messages are returned for unknown email vs.
 * wrong password to avoid user enumeration.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  const emailFingerprint = getIdentifierFingerprint(email);

  logger.info('auth.login.attempt', {
    requestId: req.id,
    emailFingerprint
  });

  try {
    const user = await authService.authenticateUser({ email, password });

    logger.info('auth.login.success', {
      requestId: req.id,
      userId: user.id
    });

    const token = createAccessToken(user);
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    setAuthCookies(res, token, refreshToken);
    res.json({ success: true, ...user });
  } catch (error) {
    if (error.code === 'missing_credentials') {
      logger.warn('auth.login.validation_failed', {
        requestId: req.id,
        emailFingerprint,
        reason: 'missing_credentials'
      });

      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'invalid_email_format') {
      logger.warn('auth.login.validation_failed', {
        requestId: req.id,
        emailFingerprint,
        reason: 'invalid_email_format'
      });

      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_verified') {
      logger.info('auth.login.blocked', {
        requestId: req.id,
        userId: error.userId,
        reason: 'email_not_verified'
      });

      return res.status(401).json({ error: 'Please verify your email before signing in.' });
    }
    if (error.code === 'invalid_credentials') {
      logger.warn('auth.login.failed', {
        requestId: req.id,
        ...(error.userId ? { userId: error.userId } : {}),
        emailFingerprint,
        reason: 'invalid_credentials'
      });

      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    logger.error('auth.login.error', {
      requestId: req.id,
      emailFingerprint,
      error
    });

    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Rotates the refresh token. Verifies the presented refresh token, ensures it
 * has not been revoked and is not stale relative to the last password change,
 * then issues a fresh access/refresh pair and revokes the old refresh token.
 * Rotation limits replay: a stolen refresh token is useful only until its next
 * use, after which it is revoked. If revocation of the old token fails the
 * operation aborts to avoid leaving two valid tokens.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const refresh = async (req, res) => {
  const refreshToken = req.body?.refreshToken || getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);

  if (!refreshToken) {
    logger.warn('auth.refresh.validation_failed', {
      requestId: req.id,
      reason: 'missing_refresh_token'
    });

    return res.status(400).json({ error: 'Missing refresh token' });
  }

  const user = verifyRefreshToken(refreshToken);
  if (!user) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      reason: 'invalid_or_expired_refresh_token'
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  const refreshTokenRevoked = await isTokenRevoked(user.id, refreshToken);
  if (refreshTokenRevoked) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'revoked_refresh_token'
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  // Reject refresh tokens issued before the last password change/reset, so a
  // password change cannot be "refreshed" back into a valid session.
  let refreshTokenStale;
  try {
    refreshTokenStale = await authService.isRefreshTokenStale(user.id, user.iat);
  } catch (error) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  if (refreshTokenStale) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'password_changed'
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  logger.info('auth.refresh.success', {
    requestId: req.id,
    userId: user.id
  });

  const token = createAccessToken(user);
  const nextRefreshToken = generateRefreshToken({ id: user.id, email: user.email });
  const revokeSucceeded = await revokeToken(user.id, refreshToken);

  if (!revokeSucceeded) {
    logger.error('auth.refresh.rotation_failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'refresh_token_revoke_failed'
    });

    return res.status(500).json({ error: 'Server error' });
  }

  setAuthCookies(res, token, nextRefreshToken);
  res.json({ success: true });
};

/**
 * Confirms a newly registered email using the one-time verification code.
 * Delegates code/expiry checking and the verification update to the service.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const verify = async (req, res) => {
  const { email, code } = req.body;
  try {
    res.json(await authService.verifyEmailCode({ email, code }));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.verify.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Regenerates and re-sends the email verification code for an unverified
 * account. Delegates the account lookup, code regeneration and mail to the
 * service.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const resendCode = async (req, res) => {
  const { email } = req.body;
  try {
    res.json(await authService.resendVerificationCode({ email }));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.resend_code.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Logs the user out. Identifies the user from the refresh and/or access token
 * (accepting an expired access token via ignoreExpiration), revokes whichever
 * tokens belong to that user so they cannot be reused, and clears the auth
 * cookies. Always clears cookies and responds success even on partial failure,
 * so the client ends up logged out.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const logout = async (req, res) => {
  const token = req.token || getAccessTokenFromRequest(req);
  const refreshToken = req.body?.refreshToken || getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  const refreshPayload = refreshToken ? verifyRefreshToken(refreshToken) : null;
  const accessPayload = verifyAccessToken(token, { ignoreExpiration: true });
  const authenticatedUserId = refreshPayload?.id || accessPayload?.id || null;

  if (!authenticatedUserId) {
    clearAuthCookies(res);
    return res.json({ success: true });
  }

  try {
    const revokeTasks = [];

    if (token && accessPayload?.id === authenticatedUserId) {
      revokeTasks.push(revokeToken(authenticatedUserId, token));
    }

    if (refreshToken && refreshPayload?.id === authenticatedUserId) {
      revokeTasks.push(revokeToken(authenticatedUserId, refreshToken));
    }

    await Promise.all(revokeTasks);

    clearAuthCookies(res);

    logger.info('auth.logout.success', {
      requestId: req.id,
      userId: authenticatedUserId
    });

    res.json({ success: true });
  } catch (error) {
    clearAuthCookies(res);

    logger.error('auth.logout.error', {
      requestId: req.id,
      userId: authenticatedUserId,
      error
    });

    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Starts the "forgot password" flow. Delegates to the service, which stores a
 * one-time reset code and emails it when the account exists. The response is
 * identical whether or not the email exists, to avoid revealing which emails
 * are registered; a mail-send failure is logged but does not change the
 * response (the stored code remains usable).
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const forgotPassword = async (req, res) => {
  const email = req.body?.email;
  try {
    await authService.startPasswordReset(
      { email },
      {
        onMailError: (mailError) => {
          logger.error('auth.forgot_password.mail_failed', {
            requestId: req.id,
            emailFingerprint: getIdentifierFingerprint(email),
            error: mailError
          });
        }
      }
    );

    // Same response regardless of whether the account exists.
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.forgot_password.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Completes the "forgot password" flow. Delegates code/expiry checking, the
 * password policy, hashing and persistence to the service. A missing account
 * returns the same generic "Code incorrect" error to avoid user enumeration.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  try {
    res.json(await authService.completePasswordReset({ email, code, newPassword }));
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.reset_password.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getCsrfToken,
  register,
  login,
  verify,
  resendCode,
  refresh,
  logout,
  forgotPassword,
  resetPassword
};
