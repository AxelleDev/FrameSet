import React from 'react';
import PropTypes from 'prop-types';

// Small uppercase pill used to label sections/categories, with a per-color accent.
const COLORS = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-blue/10 text-blue',
  danger: 'bg-danger/10 text-danger',
};

export default function Badge({ color = 'primary', className = '', children, ...rest }) {
  const tone = COLORS[color] || COLORS.primary;
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${tone} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}

Badge.propTypes = {
  color: PropTypes.oneOf(['primary', 'blue', 'danger']),
  className: PropTypes.string,
  children: PropTypes.node,
};
