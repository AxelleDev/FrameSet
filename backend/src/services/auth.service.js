/**
 * Authentication service.
 *
 * Owns the business logic and SQL for the auth lifecycle: registration with
 * email verification, credential checking on login, refresh-token rotation
 * decisions, email verification and code resend, and the password-reset flow.
 * Functions take plain arguments and return data, or throw an AuthServiceError
 * carrying a `code` (and, where relevant, the user-facing `message`) that the
 * controller maps to a specific HTTP status and JSON body. HTTP concerns
 * (cookies, token issuance, logging) stay in the controller.
 */

const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../database');
const mailService = require('./mail.service');
const { generateVerificationCode, getInitials } = require('../utils/auth.utils');
const { isTokenStaleByPasswordChange } = require('./token.service');
const { BCRYPT_SALT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_COMPLEXITY_REGEX } = require('../config/security.config');

/** Coerces a value to a trimmed string, treating null/undefined as empty. */
const normalizeInput = (value) => validator.trim(String(value ?? ''));

/**
 * Error type thrown by service functions to signal a business/validation
 * failure. The controller maps `code` to the appropriate HTTP status; the
 * `message` (when present) is surfaced to the client unchanged.
 */
class AuthServiceError extends Error {
  constructor(code, message, userId = null) {
    super(message || code);
    this.name = 'AuthServiceError';
    this.code = code;
    this.userId = userId;
  }
}

/**
 * Registers a new user. Validates input, enforces the password policy, hashes
 * the password with bcrypt, stores the account as unverified with a one-time
 * verification code, and emails that code. Throws AuthServiceError('validation',
 * msg) on invalid input and AuthServiceError('duplicate_email') when the email
 * already exists (the controller maps both to a 400 generic message).
 * @param {{name:*, email:*, password:*}} payload Raw registration fields.
 * @returns {Promise<Object>} The created user's client representation.
 */
const registerUser = async ({ name: rawName, email: rawEmail, password: rawPassword }) => {
  const name = normalizeInput(rawName);
  const email = normalizeInput(rawEmail);
  const password = normalizeInput(rawPassword);

  if (!name || !email || !password) {
    throw new AuthServiceError('validation', 'Tous les champs sont obligatoires.');
  }

  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Email invalide.');
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    throw new AuthServiceError('validation', 'Mot de passe trop court.');
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    throw new AuthServiceError('validation', 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
  }

  const initials = getInitials(name);
  const { code: verificationCode, expires } = generateVerificationCode();

  try {
    // Hash with the configured bcrypt cost factor; never store plaintext.
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

    return {
      email,
      user: {
        id: result.insertId,
        name,
        email,
        avatarInitials: initials,
        is_verified: false,
        passwordUpdatedAt: now
      }
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AuthServiceError('duplicate_email');
    }
    throw error;
  }
};

/**
 * Authenticates a user with email and password. Validates input, rejects
 * unverified accounts, and compares the password against the bcrypt hash. On
 * success returns the user's client representation. Throws AuthServiceError with
 * a `code` the controller maps: 'validation' (400), 'invalid_credentials' (401),
 * 'not_verified' (401).
 * @param {{email:*, password:*}} payload Raw login fields.
 * @returns {Promise<Object>} The authenticated user's client representation.
 */
const authenticateUser = async ({ email: rawEmail, password: rawPassword }) => {
  let email = rawEmail;
  let password = rawPassword;

  if (!email || !password) {
    throw new AuthServiceError('missing_credentials', 'Tous les champs sont obligatoires.');
  }

  email = validator.trim(email);
  password = validator.trim(password);

  if (!validator.isEmail(email)) {
    throw new AuthServiceError('invalid_email_format', 'Email invalide.');
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    throw new AuthServiceError('invalid_credentials');
  }

  const userDb = rows[0];
  if (!userDb.is_verified) {
    throw new AuthServiceError('not_verified', null, userDb.id);
  }

  const isMatch = await bcrypt.compare(password, userDb.password);
  if (!isMatch) {
    throw new AuthServiceError('invalid_credentials', null, userDb.id);
  }

  return {
    id: userDb.id,
    name: userDb.name,
    email: userDb.email,
    avatarInitials: userDb.avatar_initials,
    passwordUpdatedAt: userDb.password_updated_at,
    pendingEmail: userDb.pending_email
  };
};

/**
 * Determines whether a refresh token is stale relative to the user's last
 * password change. Wraps token.service.isTokenStaleByPasswordChange so the
 * controller need not import it directly.
 * @param {number} userId Token subject.
 * @param {number} issuedAt Token "iat" (issued-at) claim, in seconds.
 * @returns {Promise<boolean>} True if the token predates the last password change.
 */
const isRefreshTokenStale = (userId, issuedAt) => isTokenStaleByPasswordChange(userId, issuedAt);

/**
 * Confirms a newly registered email using the one-time verification code.
 * Validates input, the code and its expiry, then marks the account verified and
 * clears the code so it cannot be reused. Throws AuthServiceError('validation',
 * msg) for every invalid-input/invalid-code case (all 400).
 * @param {{email:*, code:*}} payload Raw verification fields.
 * @returns {Promise<{success:boolean}>}
 */
const verifyEmailCode = async ({ email, code }) => {
  if (!email || !code) {
    throw new AuthServiceError('validation', 'Email et code sont obligatoires.');
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    throw new AuthServiceError('validation', 'Email invalide.');
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [validator.trim(String(email))]);
  if (rows.length === 0) {
    throw new AuthServiceError('validation', 'Utilisateur non trouvé.');
  }
  const userDb = rows[0];
  if (userDb.is_verified) {
    throw new AuthServiceError('validation', 'Utilisateur déjà vérifié.');
  }
  if (!userDb.verification_code || userDb.verification_code !== code) {
    throw new AuthServiceError('validation', 'Code incorrect.');
  }
  if (!userDb.verification_code_expires || new Date() > new Date(userDb.verification_code_expires)) {
    throw new AuthServiceError('validation', 'Code expiré. Veuillez en demander un nouveau.');
  }
  await db.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE email = ?', [email]);
  return { success: true };
};

/**
 * Regenerates and re-sends the email verification code for an unverified
 * account, replacing any previous code and its expiry. Throws
 * AuthServiceError('validation', msg) for every invalid-input/account case
 * (all 400).
 * @param {{email:*}} payload Raw resend fields.
 * @returns {Promise<{success:boolean}>}
 */
const resendVerificationCode = async ({ email }) => {
  if (!email) {
    throw new AuthServiceError('validation', 'Email obligatoire.');
  }
  if (!validator.isEmail(validator.trim(String(email)))) {
    throw new AuthServiceError('validation', 'Email invalide.');
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [validator.trim(String(email))]);
  if (rows.length === 0) {
    throw new AuthServiceError('validation', 'Utilisateur non trouvé.');
  }
  const userDb = rows[0];
  if (userDb.is_verified) {
    throw new AuthServiceError('validation', 'Utilisateur déjà vérifié.');
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

  return { success: true };
};

/**
 * Starts the "forgot password" flow: if the email matches an account, stores a
 * one-time reset code (with expiry) and emails it. Validates input (throwing
 * AuthServiceError('validation', msg) on failure) but otherwise behaves
 * identically whether or not the email exists, to avoid revealing which emails
 * are registered. A mail-send failure is reported back via onMailError so the
 * controller can log it without changing the response.
 * @param {{email:*}} payload Raw request fields.
 * @param {{onMailError?: (error:Error)=>void}} [hooks]
 * @returns {Promise<void>}
 */
const startPasswordReset = async ({ email: rawEmail }, { onMailError } = {}) => {
  const email = normalizeInput(rawEmail);
  if (!email) {
    throw new AuthServiceError('validation', 'Email obligatoire.');
  }
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Email invalide.');
  }

  const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

  if (rows.length > 0) {
    const { code, expires } = generateVerificationCode();
    await db.query(
      'UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE email = ?',
      [code, expires, email]
    );

    try {
      await mailService.sendMail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Votre code de réinitialisation est : ${code}\nCe code expire dans 10 minutes.`,
        html: mailService.buildTemplate({
          title: 'Réinitialisation de votre mot de passe',
          message: 'Utilisez le code ci-dessous pour choisir un nouveau mot de passe.',
          code
        })
      });
    } catch (mailError) {
      // Never leak whether the email exists: surface the send failure to the
      // controller for logging but keep the generic success response. The
      // stored code stays valid.
      if (onMailError) onMailError(mailError);
    }
  }
};

/**
 * Completes the "forgot password" flow: validates input, the reset code and its
 * expiry, enforces the password policy, hashes and stores the new password, and
 * clears the reset code so it cannot be reused. A missing account returns the
 * same generic "Code incorrect" error to avoid user enumeration. Every failure
 * is an AuthServiceError('validation', msg) (all 400).
 * @param {{email:*, code:*, newPassword:*}} payload Raw request fields.
 * @returns {Promise<{success:boolean}>}
 */
const completePasswordReset = async ({ email: rawEmail, code: rawCode, newPassword }) => {
  const email = normalizeInput(rawEmail);
  const code = normalizeInput(rawCode);
  const password = normalizeInput(newPassword);

  if (!email || !code || !password) {
    throw new AuthServiceError('validation', 'Email, code et nouveau mot de passe sont obligatoires.');
  }
  if (!validator.isEmail(email)) {
    throw new AuthServiceError('validation', 'Email invalide.');
  }
  if (!validator.isLength(password, { min: PASSWORD_MIN_LENGTH })) {
    throw new AuthServiceError('validation', 'Mot de passe trop court.');
  }
  if (!validator.matches(password, PASSWORD_COMPLEXITY_REGEX)) {
    throw new AuthServiceError('validation', 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    throw new AuthServiceError('validation', 'Code incorrect.');
  }

  const userDb = rows[0];
  if (!userDb.reset_code || userDb.reset_code !== code) {
    throw new AuthServiceError('validation', 'Code incorrect.');
  }
  if (!userDb.reset_code_expires || new Date() > new Date(userDb.reset_code_expires)) {
    throw new AuthServiceError('validation', 'Code expiré. Veuillez en demander un nouveau.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  await db.query(
    'UPDATE users SET password = ?, password_updated_at = NOW(), reset_code = NULL, reset_code_expires = NULL WHERE email = ?',
    [hashedPassword, email]
  );

  return { success: true };
};

module.exports = {
  AuthServiceError,
  registerUser,
  authenticateUser,
  isRefreshTokenStale,
  verifyEmailCode,
  resendVerificationCode,
  startPasswordReset,
  completePasswordReset
};
