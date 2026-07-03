import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import TextInput from './TextInput';

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

// Password input with a reveal/hide toggle. Unrecognized props are forwarded
// to the underlying input (value, onChange, name, placeholder, ...).
export default function PasswordInput({
  className = '',
  inputClassName = '',
  buttonClassName = 'text-primary',
  disabled = false,
  ...inputProps
}) {
  const [isVisible, setIsVisible] = useState(false);

  // Only reveal the eye toggle once the field has content (Google/Microsoft
  // pattern) to keep empty forms lighter. Reset visibility when it is cleared.
  const hasValue = Boolean(inputProps.value);
  useEffect(() => {
    if (!hasValue) setIsVisible(false);
  }, [hasValue]);

  return (
    <div className={`relative ${className}`.trim()}>
      <TextInput
        {...inputProps}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={`pr-12 ${inputClassName}`.trim()}
      />

      {hasValue && (
        <button
          type="button"
          onClick={() => setIsVisible((prev) => !prev)}
          disabled={disabled}
          className={`absolute inset-y-0 right-0 px-3 flex items-center justify-center rounded-lg transition-colors focus-ring ${buttonClassName} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`.trim()}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
    </div>
  );
}

PasswordInput.propTypes = {
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  buttonClassName: PropTypes.string,
  disabled: PropTypes.bool,
};