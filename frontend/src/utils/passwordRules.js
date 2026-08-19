export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'One digit', test: (p) => /[0-9]/.test(p) },
];

/** Whether a password satisfies every rule of the policy. */
export const isPasswordValid = (password) =>
  PASSWORD_RULES.every((rule) => rule.test(password || ''));

/** Basic email format check for client-side validation. */
export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
