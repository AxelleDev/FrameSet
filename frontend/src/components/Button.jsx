import React from 'react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled = false,
  ...rest
}) {
  const base = 'font-medium rounded-xl transition-all inline-flex items-center justify-center';

  const size = fullWidth ? 'w-full py-4' : 'px-6 py-2.5 text-sm';

  const variants = {
    primary: 'bg-blue text-white hover:bg-pink/10 hover:shadow-lg',
    secondary: 'bg-pink text-white hover:bg-pink/10 hover:shadow-lg',
    ghost: 'bg-transparent text-primary',
  };

  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const classes = `${base} ${size} ${variants[variant] || ''} ${disabledClass} ${className}`.trim();

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  );
}
