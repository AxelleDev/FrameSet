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
