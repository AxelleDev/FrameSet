// Reusable action icon button.
import React from 'react';

// Hover color mapping by semantic intent (e.g. edit vs delete).
const INTENT_CLASSES = {
  edit: 'hover:bg-blue',
  delete: 'hover:bg-danger'
};

// Base background mapping for use on dark or light surfaces.
const VARIANT_CLASSES = {
  dark: 'bg-black/20',
  light: 'bg-white/20'
};

/**
 * Small circular icon button used for row/card actions (edit, delete, ...).
 * Stays hidden until the parent `group` is hovered.
 *
 * @param {object} props
 * @param {Function} props.onClick - Click handler.
 * @param {string} props.title - Accessible title/label (also used as aria-label).
 * @param {React.ReactNode} props.children - Icon element to render.
 * @param {'edit'|'delete'} [props.intent] - Semantic intent driving the hover color.
 * @param {'dark'|'light'} [props.variant] - Surface variant driving the base background.
 * @param {string} [props.className] - Extra classes appended to the button.
 */
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
  // If the child is a raw <svg>, mark it decorative so screen readers rely on the button's aria-label.
  let icon = children;
  if (React.isValidElement(children)) {
    try {
      const type = children.type;
      if (typeof type === 'string' && type.toLowerCase() === 'svg') {
        icon = React.cloneElement(children, { 'aria-hidden': true, focusable: false });
      }
    } catch (e) {
      // ignore non-element children
    }
  }

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-all duration-base hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 ring-offset-canvas ${className}`.trim()}
    >
      {icon}
    </button>
  );
}
