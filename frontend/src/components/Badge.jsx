import React from 'react';

/**
 * Small uppercase pill used to label sections/categories (e.g. "Trait",
 * "Typographie"). Outlined on white with a per-color accent.
 *
 * @param {object} props
 * @param {'primary'|'blue'|'danger'} [props.color] - Accent color.
 * @param {string} [props.className] - Extra classes.
 * @param {React.ReactNode} props.children - Label content.
 */
const COLORS = {
  primary: 'border-primary text-primary',
  blue: 'border-blue text-blue',
  danger: 'border-danger text-danger',
};

export default function Badge({ color = 'primary', className = '', children, ...rest }) {
  const tone = COLORS[color] || COLORS.primary;
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full bg-white border shadow-sm text-[10px] font-bold uppercase tracking-wider ${tone} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
