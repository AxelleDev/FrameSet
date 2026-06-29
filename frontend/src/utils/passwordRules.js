/**
 * Shared password policy used for live client-side feedback. Mirrors the
 * backend rule (PASSWORD_COMPLEXITY_REGEX in security.config.js): at least 8
 * characters, with one lowercase letter, one uppercase letter and one digit.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Au moins 8 caractères', test: (p) => p.length >= 8 },
  { id: 'lowercase', label: 'Une lettre minuscule', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'Une lettre majuscule', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Un chiffre', test: (p) => /[0-9]/.test(p) },
];

/** Whether a password satisfies every rule of the policy. */
export const isPasswordValid = (password) => PASSWORD_RULES.every((rule) => rule.test(password || ''));

/** Basic email format check for client-side validation. */
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
