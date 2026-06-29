import React, { useState } from 'react';

// Decorative icon: password currently visible.
function EyeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// Decorative icon: password currently hidden.
function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.584 10.587a2 2 0 102.829 2.828" />
      <path d="M9.88 5.09A10.94 10.94 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.004 10.004 0 01-1.955 3.368M6.228 6.238A9.965 9.965 0 002.458 12c1.274 4.057 5.065 7 9.542 7a9.93 9.93 0 004.186-.922" />
    </svg>
  );
}

/**
 * Password text input with a toggle button to reveal/hide the value. All
 * unrecognized props are forwarded to the underlying input (value, onChange,
 * name, placeholder, ...).
 *
 * @param {object} props
 * @param {string} [props.className] - Classes for the relative wrapper.
 * @param {string} [props.inputClassName] - Classes for the input element.
 * @param {string} [props.buttonClassName] - Classes for the toggle button.
 * @param {boolean} [props.disabled] - Disables both the input and the toggle.
 */
export default function PasswordInput({
  className = '',
  inputClassName = '',
  buttonClassName = '[color:var(--color-primary)]',
  disabled = false,
  ...inputProps
}) {
  // Tracks whether the password is shown in plain text.
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        {...inputProps}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={`${inputClassName} pr-12`.trim()}
      />

      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        disabled={disabled}
        className={`absolute inset-y-0 right-0 px-3 flex items-center justify-center transition-colors ${buttonClassName} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`.trim()}
        aria-label={isVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={isVisible}
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}