// Reusable action icon button.
import React from 'react';
import PropTypes from 'prop-types';

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
 * @param {boolean} [props.srOnly] - Render visually hidden but still operable by
 *   keyboard/assistive tech (the action exists only for screen readers).
 * @param {string} [props.className] - Extra classes appended to the button.
 */
export default function ActionIconButton({
  onClick,
  title,
  children,
  intent = 'edit',
  variant = 'dark',
  disabled = false,
  srOnly = false,
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

  // Visually hidden variant: kept in the accessibility tree (and keyboard
  // focusable) but with no visual footprint, so the action is exposed only to
  // assistive technologies.
  if (srOnly) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`sr-only ${className}`.trim()}
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
      className={`w-9 h-9 flex items-center justify-center ${variantClass} ${intentClass} backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-all duration-base hover:scale-110 focus-ring disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-white/20 ${className}`.trim()}
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
