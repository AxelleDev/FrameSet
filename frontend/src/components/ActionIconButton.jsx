import React from 'react';

const INTENT_CLASSES = {
  edit: 'hover:bg-[var(--color-blue)]',
  delete: 'hover:bg-red-500'
};

const VARIANT_CLASSES = {
  dark: 'bg-black/20',
  light: 'bg-white/20'
};

export default function ActionIconButton({
  onClick,
  title,
  children,
  intent = 'edit',
  variant = 'dark',
  className = ''
}) {
  const intentClass = INTENT_CLASSES[intent] || INTENT_CLASSES.edit;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.dark;

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-8 h-8 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 shadow-sm ${className}`.trim()}
    >
      {children}
    </button>
  );
}
