// Live password-policy checklist: each rule turns green as the password meets it.
import React from 'react';
import { PASSWORD_RULES } from '../utils/passwordRules';

/**
 * Renders the password requirements, each marked satisfied/unsatisfied based on
 * the current value. Hidden until the user starts typing a password.
 *
 * @param {object} props
 * @param {string} props.password - The current password value.
 */
export default function PasswordChecklist({ password }) {
  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1" aria-label="Exigences du mot de passe">
      {PASSWORD_RULES.map((rule) => {
        const satisfied = rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-2 text-xs transition-colors ${satisfied ? 'text-green-600' : 'text-blue/70'}`}
          >
            <span aria-hidden="true" className="font-bold w-3 inline-block text-center">
              {satisfied ? '✓' : '○'}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
