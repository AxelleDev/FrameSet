import React from 'react';
import PropTypes from 'prop-types';

// Inline feedback text (form errors, info, success). Plain colored text; the per-variant
// ARIA role keeps it announced to assistive tech.
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
