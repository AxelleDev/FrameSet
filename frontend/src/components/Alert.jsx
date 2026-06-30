import React from 'react';

/**
 * Inline feedback banner (form errors, info, success) with a consistent soft
 * tinted look. Keeps dark, readable text on a light accent tint rather than
 * white-on-light, and wires the right ARIA role per variant.
 *
 * @param {object} props
 * @param {'error'|'info'|'success'} [props.variant] - Visual tone.
 * @param {string} [props.className] - Extra classes.
 * @param {React.ReactNode} props.children - Message content.
 */
const VARIANTS = {
  error: 'bg-pink/15 border border-pink/40 text-primary',
  info: 'bg-blue/10 border border-blue/30 text-primary',
  success: 'bg-blue/10 border border-blue/30 text-primary',
};

export default function Alert({ variant = 'info', className = '', children, ...rest }) {
  const tone = VARIANTS[variant] || VARIANTS.info;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`p-3 rounded-xl text-xs text-center font-medium ${tone} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
