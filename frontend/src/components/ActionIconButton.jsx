// Bouton icone d'action reutilisable.
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
  let icon = children;
  if (React.isValidElement(children)) {
    try {
      const type = children.type;
      if (typeof type === 'string' && type.toLowerCase() === 'svg') {
        icon = React.cloneElement(children, { 'aria-hidden': true, focusable: false });
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-8 h-8 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2 ${className}`.trim()}
    >
      {icon}
    </button>
  );
}
