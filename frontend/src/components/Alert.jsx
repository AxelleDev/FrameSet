import React from 'react';
import PropTypes from 'prop-types';

/**
 * Inline feedback banner (form errors, info, success) with a consistent soft
 * tinted look. Keeps dark, readable text on a light accent tint rather than
 * white-on-light, wires the right ARIA role per variant, and shows a per-variant
 * icon so the meaning is not conveyed by color alone (WCAG 1.4.1).
 *
 * @param {object} props
 * @param {'error'|'info'|'success'} [props.variant] - Visual tone.
 * @param {string} [props.className] - Extra classes.
 * @param {React.ReactNode} props.children - Message content.
 */
const VARIANTS = {
  error: { tone: 'bg-danger/10 text-primary', icon: 'M6 18L18 6M6 6l12 12' },
  info: { tone: 'bg-blue/10 text-primary', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  success: { tone: 'bg-success/10 text-primary', icon: 'M5 13l4 4L19 7' },
};

const ICON_COLOR = {
  error: 'text-danger',
  info: 'text-blue',
  success: 'text-success',
};

export default function Alert({ variant = 'info', className = '', children, ...rest }) {
  const { tone, icon } = VARIANTS[variant] || VARIANTS.info;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs text-center font-medium ${tone} ${className}`.trim()}
      {...rest}
    >
      <svg className={`h-4 w-4 flex-shrink-0 ${ICON_COLOR[variant] || ICON_COLOR.info}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={icon} />
      </svg>
      <span>{children}</span>
    </div>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(['error', 'info', 'success']),
  className: PropTypes.string,
  children: PropTypes.node,
};
