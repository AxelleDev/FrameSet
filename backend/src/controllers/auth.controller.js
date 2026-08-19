const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const twoFactorService = require('../services/twoFactor.service');
const { getIdentifierFingerprint, getBearerToken } = require('../utils/auth.utils');
const {
  issueAuthCookies,
  clearAuthCookies,
  createTotpChallengeToken,
  verifyTotpChallengeToken,
} = require('../utils/session.utils');
const { createCsrfToken } = require('../middleware/csrfProtection');
const { verifyRefreshToken, revokeToken, isTokenRevoked } = require('../services/token.service');
const { JWT_SECRET } = require('../config/jwt.config');
const {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  getCsrfTokenCookieOptions,
  getCookieValue,
} = require('../utils/cookies.utils');
const { logger } = require('../utils/logger');

/** Resolves the access token from the Authorization header or the cookie. */
const getAccessTokenFromRequest = (req) =>
  getBearerToken(req) || getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);

// Verify an access token -> decoded payload or null. ignoreExpiration lets logout
// still identify and revoke an expired-but-valid token.
const verifyAccessToken = (token, { ignoreExpiration = false } = {}) => {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET, { ignoreExpiration, algorithms: ['HS256'] });
  } catch (error) {
    return null;
  }
};

// Issue (or reuse) the double-submit CSRF token: reuse the cookie value so cookie and
// body stay in sync. Returned in the body so the SPA can send it as x-csrf-token.
const getCsrfToken = (req, res) => {
  const existingCsrfToken = getCookieValue(req, CSRF_TOKEN_COOKIE_NAME);
  const csrfToken = existingCsrfToken || createCsrfToken();

  res.cookie(CSRF_TOKEN_COOKIE_NAME, csrfToken, getCsrfTokenCookieOptions());
  return res.json({ csrfToken });
};

// Register a new user. Duplicate-email is logged but surfaced generically to avoid
// leaking which emails exist.
const register = async (req, res) => {
  const body = req.body || {};
  try {
    const { user } = await authService.registerUser(body, {
      onMailError: (mailError) => {
        // The account was created; log the send failure but still return success so
        // the user isn't stranded (they can request a new code via resend-code).
        logger.error('auth.register.mail_failed', {
          requestId: req.id,
          emailFingerprint: getIdentifierFingerprint(body.email),
          error: mailError,
        });
      },
    });
    res.status(201).json({ success: true, ...user });
  } catch (error) {
    const email = body.email;
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'duplicate_email') {
      logger.warn('auth.register.duplicate_email', {
        requestId: req.id,
        emailFingerprint: getIdentifierFingerprint(email),
      });
      return res.status(400).json({ error: 'Something went wrong while creating your account.' });
    }

    logger.error('auth.register.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Authenticate with email/password; on success set access + refresh cookies. Unknown
// email and wrong password return the same generic error to avoid user enumeration.
const login = async (req, res) => {
  const { email, password } = req.body;
  const emailFingerprint = getIdentifierFingerprint(email);

  logger.info('auth.login.attempt', {
    requestId: req.id,
    emailFingerprint,
  });

  try {
    const user = await authService.authenticateUser({ email, password });

    // Password checked out, but the account has 2FA enabled: defer the
    // session and hand back a short-lived challenge token instead of
    // anything else about the account (see authenticateUser's requiresTotp
    // branch — no name/email is disclosed at this point).
    if (user.requiresTotp) {
      logger.info('auth.login.totp_required', {
        requestId: req.id,
        userId: user.id,
      });

      return res.json({
        success: true,
        requiresTotp: true,
        challengeToken: createTotpChallengeToken(user.id),
      });
    }

    logger.info('auth.login.success', {
      requestId: req.id,
      userId: user.id,
    });

    issueAuthCookies(res, user);
    res.json({ success: true, ...user });
  } catch (error) {
    if (error.code === 'missing_credentials') {
      logger.warn('auth.login.validation_failed', {
        requestId: req.id,
        emailFingerprint,
        reason: 'missing_credentials',
      });

      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'invalid_email_format') {
      logger.warn('auth.login.validation_failed', {
        requestId: req.id,
        emailFingerprint,
        reason: 'invalid_email_format',
      });

      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'not_verified') {
      logger.info('auth.login.blocked', {
        requestId: req.id,
        userId: error.userId,
        reason: 'email_not_verified',
      });

      return res
        .status(401)
        .json({ error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
    }
    if (error.code === 'google_account') {
      logger.info('auth.login.blocked', {
        requestId: req.id,
        userId: error.userId,
        reason: 'google_only_account',
      });

      return res.status(401).json({
        error:
          'This account uses Google sign-in. Continue with Google, or use "Forgot password" to create a password.',
        code: 'GOOGLE_ACCOUNT',
      });
    }
    if (error.code === 'invalid_credentials') {
      logger.warn('auth.login.failed', {
        requestId: req.id,
        ...(error.userId ? { userId: error.userId } : {}),
        emailFingerprint,
        reason: 'invalid_credentials',
      });

      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    logger.error('auth.login.error', {
      requestId: req.id,
      emailFingerprint,
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Completes a 2FA-enabled login: verifies the challenge token issued by
// login() is genuine and unexpired, then the submitted code — a live TOTP
// code or, failing that, a single-use recovery code (see
// twoFactor.service.verifyTotpChallenge). Only on success does the real
// session finally get issued.
const loginTotp = async (req, res) => {
  const { challengeToken, code } = req.body || {};

  const challenge = verifyTotpChallengeToken(challengeToken);
  if (!challenge) {
    logger.warn('auth.login_totp.invalid_challenge', { requestId: req.id });
    return res.status(403).json({ error: 'This session has expired. Please sign in again.' });
  }

  try {
    const { usedRecoveryCode } = await twoFactorService.verifyTotpChallenge(challenge.id, code);
    const user = await authService.getSessionUserById(challenge.id);

    logger.info('auth.login_totp.success', {
      requestId: req.id,
      userId: user.id,
      usedRecoveryCode,
    });

    issueAuthCookies(res, user);
    res.json({ success: true, ...user });
  } catch (error) {
    if (error.code === 'invalid_code' || error.code === 'not_enabled') {
      logger.warn('auth.login_totp.failed', {
        requestId: req.id,
        userId: challenge.id,
        reason: error.code,
      });

      return res.status(401).json({ error: 'Incorrect code.' });
    }

    logger.error('auth.login_totp.error', {
      requestId: req.id,
      userId: challenge.id,
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// "Try without an account": logs into the single shared, read-only demo
// account — no credentials needed. Same cookie-issuing/response shape as login.
const demoLogin = async (req, res) => {
  try {
    const user = await authService.loginAsDemo();

    logger.info('auth.demo_login.success', {
      requestId: req.id,
      userId: user.id,
    });

    issueAuthCookies(res, user);
    res.json({ success: true, ...user });
  } catch (error) {
    if (error.code === 'demo_unavailable') {
      return res.status(503).json({ error: error.message });
    }

    logger.error('auth.demo_login.error', {
      requestId: req.id,
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Authenticate with a Google ID token: the service verifies it against Google's
// keys and resolves/creates the account; on success the same session cookies as
// a password login are issued. Failure reasons are surfaced without detail.
const googleSignIn = async (req, res) => {
  try {
    const user = await authService.authenticateWithGoogle(req.body?.credential, {
      onMailError: (mailError) => {
        logger.error('auth.google.link_mail_failed', {
          requestId: req.id,
          error: mailError,
        });
      },
    });

    // Google proved the identity, but the account has 2FA enabled: same
    // deferred-session contract as login() — a challenge token, no cookies,
    // nothing else about the account disclosed yet.
    if (user.requiresTotp) {
      logger.info('auth.google.totp_required', {
        requestId: req.id,
        userId: user.id,
      });

      return res.json({
        success: true,
        requiresTotp: true,
        challengeToken: createTotpChallengeToken(user.id),
      });
    }

    logger.info('auth.google.success', {
      requestId: req.id,
      userId: user.id,
    });

    issueAuthCookies(res, user);
    res.json({ success: true, ...user });
  } catch (error) {
    if (error.code === 'google_not_configured') {
      return res.status(503).json({ error: 'Google sign-in is not available.' });
    }
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'invalid_google_token') {
      logger.warn('auth.google.failed', {
        requestId: req.id,
        reason: 'invalid_google_token',
      });

      return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
    }
    if (error.code === 'google_email_not_verified') {
      logger.warn('auth.google.failed', {
        requestId: req.id,
        reason: 'google_email_not_verified',
      });

      return res
        .status(401)
        .json({ error: 'Your Google email address is not verified with Google.' });
    }

    logger.error('auth.google.error', {
      requestId: req.id,
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Rotate the refresh token: verify, reject revoked/stale tokens, then issue a fresh pair
// and revoke the old one. Rotation limits replay of a stolen token; aborts if the old
// token can't be revoked so we never leave two valid tokens.
const refresh = async (req, res) => {
  // Cookie only: the frontend never sends this in the body, and accepting a
  // body-supplied token would just widen the attack surface for no gain (a
  // token in a request body is more likely to end up in a proxy/access log
  // than one confined to an httpOnly cookie).
  const refreshToken = getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);

  if (!refreshToken) {
    logger.warn('auth.refresh.validation_failed', {
      requestId: req.id,
      reason: 'missing_refresh_token',
    });

    return res.status(400).json({ error: 'Missing refresh token.' });
  }

  const user = verifyRefreshToken(refreshToken);
  if (!user) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      reason: 'invalid_or_expired_refresh_token',
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }

  // isTokenRevoked fails closed by throwing on a DB error. Catch it here (as we do
  // for isRefreshTokenStale below): under Express 4 an escaped async rejection never
  // reaches the error middleware and, on Node >=20, would crash the process.
  let refreshTokenRevoked;
  try {
    refreshTokenRevoked = await isTokenRevoked(user.id, refreshToken);
  } catch (error) {
    logger.error('auth.refresh.error', {
      requestId: req.id,
      userId: user.id,
      reason: 'revocation_check_failed',
      error,
    });

    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
  if (refreshTokenRevoked) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'revoked_refresh_token',
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }

  // Reject tokens issued before the last password change so a changed password
  // cannot be "refreshed" back into a valid session.
  let refreshTokenStale;
  try {
    refreshTokenStale = await authService.isRefreshTokenStale(user.id, user.iat);
  } catch (error) {
    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
  if (refreshTokenStale) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'password_changed',
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }

  // Claim the rotation atomically: revoke the presented token FIRST and only proceed
  // if this call actually inserted the revocation row. INSERT IGNORE is the lock, so
  // two concurrent refreshes with the same token can't both mint a fresh valid pair.
  const rotationClaimed = await revokeToken(user.id, refreshToken);
  if (!rotationClaimed) {
    logger.warn('auth.refresh.rotation_failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'refresh_token_already_rotated',
    });

    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }

  // Logged only once the rotation claim is won, so a refresh that ends up
  // rejected just above can never emit a success entry for the same request.
  logger.info('auth.refresh.success', {
    requestId: req.id,
    userId: user.id,
  });

  issueAuthCookies(res, user);
  res.json({ success: true });
};

// Confirm a newly registered email using the one-time verification code.
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
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Regenerate and re-send the email verification code for an unverified account.
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
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Log out: identify the user (accepting an expired access token), revoke their tokens
// so they can't be reused, and clear cookies. Always clears cookies and returns success
// even on partial failure, so the client ends up logged out.
const logout = async (req, res) => {
  const token = req.token || getAccessTokenFromRequest(req);
  // Cookie only — see the identical note in refresh() above.
  const refreshToken = getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  const refreshPayload = refreshToken ? verifyRefreshToken(refreshToken) : null;
  const accessPayload = verifyAccessToken(token, { ignoreExpiration: true });
  const authenticatedUserId = refreshPayload?.id || accessPayload?.id || null;

  if (!authenticatedUserId) {
    clearAuthCookies(res);
    return res.json({ success: true });
  }

  try {
    // Revocation is deliberately best-effort: revokeToken never throws, and its
    // `false` conflates "DB error" with "already revoked" (the INSERT IGNORE
    // lost-claim case), so failing the logout on `false` would break legitimate
    // logout-after-rotation races. Clearing the cookies below is the primary
    // logout mechanism either way; a token that slipped past revocation stays
    // bounded by its own short expiry.
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
      userId: authenticatedUserId,
    });

    res.json({ success: true });
  } catch (error) {
    clearAuthCookies(res);

    logger.error('auth.logout.error', {
      requestId: req.id,
      userId: authenticatedUserId,
      error,
    });

    res.status(500).json({ error: 'Server error.' });
  }
};

// Start the "forgot password" flow. Response is identical whether or not the account
// exists, to avoid revealing registered emails; a mail-send failure is logged only.
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
            error: mailError,
          });
        },
      },
    );

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.forgot_password.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error,
    });
    res.status(500).json({ error: 'Server error.' });
  }
};

// Complete the "forgot password" flow. A missing account returns the same generic
// "Code incorrect" error to avoid user enumeration.
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  try {
    res.json(
      await authService.completePasswordReset(
        { email, code, newPassword },
        {
          onMailError: (mailError) => {
            logger.error('auth.reset_password.notice_mail_failed', {
              requestId: req.id,
              emailFingerprint: getIdentifierFingerprint(email),
              error: mailError,
            });
          },
        },
      ),
    );
  } catch (error) {
    if (error.code === 'validation') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('auth.reset_password.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error,
    });
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getCsrfToken,
  register,
  login,
  loginTotp,
  demoLogin,
  googleSignIn,
  verify,
  resendCode,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
