// Reusable action icon button.
import React from 'react';
import PropTypes from 'prop-types';

// Hover color mapping by semantic intent (e.g. edit vs delete).
const INTENT_CLASSES = {
  edit: 'hover:bg-blue',
  delete: 'hover:bg-danger',
};

// Base background mapping for use on dark or light surfaces.
const VARIANT_CLASSES = {
  dark: 'bg-black/20',
  light: 'bg-white/20',
};

// Small circular icon button for row/card actions; stays hidden until the parent
// `group` is hovered — or, on touch (no hover), press-and-held (see group-active
// below), so it never sits permanently on top of the card's content.
export default function ActionIconButton({
  onClick,
  title,
  children,
  intent = 'edit',
  variant = 'dark',
  disabled = false,
  srOnly = false,
  className = '',
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
      // Ignore non-element children.
    }
  }

  // Hidden until keyboard-focused (sr-only + focus:not-sr-only, same escape-hatch
  // pattern as the skip link): a mouse user reorders by dragging, so this stays out
  // of their way, but a keyboard-only user — sighted or not — needs to both reach
  // AND see it, so it must render fully (not just be exposed to assistive tech).
  if (srOnly) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`sr-only focus:not-sr-only focus:absolute focus:z-40 w-9 h-9 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white focus-ring disabled:opacity-30 disabled:cursor-not-allowed ${className}`.trim()}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-9 h-9 [@media(hover:none)]:w-11 [@media(hover:none)]:h-11 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-active:opacity-100 transition-all duration-base hover:scale-110 focus-ring disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-white/20 ${className}`.trim()}
    >
      {icon}
    </button>
  );
}

ActionIconButton.propTypes = {
  onClick: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  intent: PropTypes.oneOf(['edit', 'delete']),
  variant: PropTypes.oneOf(['dark', 'light']),
  disabled: PropTypes.bool,
  srOnly: PropTypes.bool,
  className: PropTypes.string,
};
