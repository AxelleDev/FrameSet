const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../database');
const mailService = require('../services/mail.service');
const jwt = require('jsonwebtoken');
const { generateVerificationCode, getIdentifierFingerprint } = require('../utils/auth.utils');
const { generateRefreshToken, verifyRefreshToken, revokeToken, isTokenRevoked } = require('../services/token.service');
const { BCRYPT_SALT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_COMPLEXITY_REGEX } = require('../config/security.config');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt.config');
const { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, getAccessTokenCookieOptions, getRefreshTokenCookieOptions, getCookieBaseOptions, getCookieValue } = require('../utils/cookies.utils');
const { logger } = require('../utils/logger');

const normalizeInput = (value) => validator.trim(String(value ?? ''));
const getInitials = (name) => name
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .join('')
  .substring(0, 2)
  .toUpperCase();

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, getAccessTokenCookieOptions());
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
};

const clearAuthCookies = (res) => {
  const cookieOptions = getCookieBaseOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions);
};

const getBearerToken = (req) => {
  const authHeader = req?.headers?.authorization;
  return authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
};

const getAccessTokenFromRequest = (req) => getBearerToken(req) || getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);

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

const createAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

const register = async (req, res) => {
  const { name: rawName, email: rawEmail, password: rawPassword } = req.body || {};

  const name = normalizeInput(rawName);
  const email = normalizeInput(rawEmail);
  const password = normalizeInput(rawPassword);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    return res.status(400).json({ error: 'Mot de passe trop court.' });
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.' });
  }

  const initials = getInitials(name);
  const { code: verificationCode, expires } = generateVerificationCode();

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar_initials, is_verified, verification_code, verification_code_expires, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, initials, false, verificationCode, expires, now]
    );

    await mailService.sendMail({
      to: email,
      subject: 'Confirmation de votre inscription',
      text: `Votre code de confirmation est : ${verificationCode}\nCe code expire dans 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Confirmation de votre inscription',
        message: 'Utilisez le code ci-dessous pour confirmer votre adresse email.',
        code: verificationCode
      })
    });

    const newUser = {
      id: result.insertId,
      name,
      email,
      avatarInitials: initials,
      is_verified: false,
      passwordUpdatedAt: now
    };
    res.json({ success: true, ...newUser });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      logger.warn('auth.register.duplicate_email', {
        requestId: req.id,
        emailFingerprint: getIdentifierFingerprint(email)
      });
      return res.status(400).json({ error: 'Erreur lors de l’inscription.' });
    }

    logger.error('auth.register.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const login = async (req, res) => {
  let { email, password } = req.body;
  const emailFingerprint = getIdentifierFingerprint(email);

  logger.info('auth.login.attempt', {
    requestId: req.id,
    emailFingerprint
  });

  if (!email || !password) {
    logger.warn('auth.login.validation_failed', {
      requestId: req.id,
      emailFingerprint,
      reason: 'missing_credentials'
    });

    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  email = validator.trim(email);
  password = validator.trim(password);

  if (!validator.isEmail(email)) {
    logger.warn('auth.login.validation_failed', {
      requestId: req.id,
      emailFingerprint,
      reason: 'invalid_email_format'
    });

    return res.status(400).json({ error: 'Email invalide.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      logger.warn('auth.login.failed', {
        requestId: req.id,
        emailFingerprint,
        reason: 'invalid_credentials'
      });

      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const userDb = rows[0];
    if (!userDb.is_verified) {
      logger.info('auth.login.blocked', {
        requestId: req.id,
        userId: userDb.id,
        reason: 'email_not_verified'
      });

      return res.status(401).json({ error: 'Veuillez vérifier votre email avant de vous connecter.' });
    }

    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) {
      logger.warn('auth.login.failed', {
        requestId: req.id,
        userId: userDb.id,
        emailFingerprint,
        reason: 'invalid_credentials'
      });

      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = {
      id: userDb.id,
      name: userDb.name,
      email: userDb.email,
      avatarInitials: userDb.avatar_initials,
      passwordUpdatedAt: userDb.password_updated_at,
      pendingEmail: userDb.pending_email
    };

    logger.info('auth.login.success', {
      requestId: req.id,
      userId: user.id
    });

    const token = createAccessToken(user);
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    setAuthCookies(res, token, refreshToken);
    res.json({ success: true, ...user });
  } catch (error) {
    logger.error('auth.login.error', {
      requestId: req.id,
      emailFingerprint,
      error
    });

    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const refresh = async (req, res) => {
  const refreshToken = req.body?.refreshToken || getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);

  if (!refreshToken) {
    logger.warn('auth.refresh.validation_failed', {
      requestId: req.id,
      reason: 'missing_refresh_token'
    });

    return res.status(400).json({ error: 'Refresh token manquant' });
  }

  const user = verifyRefreshToken(refreshToken);
  if (!user) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      reason: 'invalid_or_expired_refresh_token'
    });

    return res.status(403).json({ error: 'Refresh token invalide ou expiré' });
  }

  const refreshTokenRevoked = await isTokenRevoked(user.id, refreshToken);
  if (refreshTokenRevoked) {
    logger.warn('auth.refresh.failed', {
      requestId: req.id,
      userId: user.id,
      reason: 'revoked_refresh_token'
    });

    return res.status(403).json({ error: 'Refresh token invalide ou expiré' });
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

    return res.status(500).json({ error: 'Erreur serveur' });
  }

  setAuthCookies(res, token, nextRefreshToken);
  res.json({ success: true });
};

const verify = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email et code sont obligatoires.' });
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [validator.trim(String(email))]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Utilisateur non trouvé.' });
    }
    const userDb = rows[0];
    if (userDb.is_verified) {
      return res.status(400).json({ error: 'Utilisateur déjà vérifié.' });
    }
    if (!userDb.verification_code || userDb.verification_code !== code) {
      return res.status(400).json({ error: 'Code incorrect.' });
    }
    if (!userDb.verification_code_expires || new Date() > new Date(userDb.verification_code_expires)) {
      return res.status(400).json({ error: 'Code expiré. Veuillez en demander un nouveau.' });
    }
    await db.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE email = ?', [email]);
    res.json({ success: true });
  } catch (error) {
    logger.error('auth.verify.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const resendCode = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email obligatoire.' });
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [validator.trim(String(email))]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Utilisateur non trouvé.' });
    }
    const userDb = rows[0];
    if (userDb.is_verified) {
      return res.status(400).json({ error: 'Utilisateur déjà vérifié.' });
    }
    const { code: newCode, expires } = generateVerificationCode();
    await db.query('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE email = ?', [newCode, expires, email]);

    await mailService.sendMail({
      to: email,
      subject: 'Nouveau code de vérification',
      text: `Votre nouveau code de vérification est : ${newCode}\nCe code expire dans 10 minutes.`,
      html: mailService.buildTemplate({
        title: 'Nouveau code de vérification',
        message: 'Voici votre nouveau code de vérification.',
        code: newCode
      })
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('auth.resend_code.error', {
      requestId: req.id,
      emailFingerprint: getIdentifierFingerprint(email),
      error
    });

    res.status(500).json({ error: 'Erreur serveur' });
  }
};

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

    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  register,
  login,
  verify,
  resendCode,
  refresh,
  logout
};
