import React from 'react';
import PropTypes from 'prop-types';

/**
 * Inline feedback text (form errors, info, success). Plain colored text — no box,
 * no background, no icon — so it reads as a natural message in its place. The
 * right ARIA role per variant keeps it announced to assistive tech.
 *
 * @param {object} props
 * @param {'danger'|'info'|'success'} [props.variant] - Text color tone.
 * @param {string} [props.className] - Extra classes.
 * @param {React.ReactNode} props.children - Message content.
 */
const TONES = {
  danger: 'text-danger',
  info: 'text-primary',
  success: 'text-success',
};

export default function Alert({ variant = 'info', className = '', children, ...rest }) {
  const tone = TONES[variant] || TONES.info;
  return (
    <p
      role={variant === 'danger' ? 'alert' : 'status'}
      className={`text-sm font-medium ${tone} ${className}`.trim()}
      {...rest}
    >
      {children}
    </p>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(['danger', 'info', 'success']),
  className: PropTypes.string,
  children: PropTypes.node,
};
