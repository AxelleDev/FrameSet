import React from 'react';
import PropTypes from 'prop-types';

/**
 * Generic surface container with rounded corners and a subtle border.
 * Adds hover/lift affordances when marked clickable. Extra props are spread
 * onto the underlying div.
 *
 * @param {object} props
 * @param {boolean} [props.clickable] - Adds pointer cursor and hover lift effect.
 * @param {string} [props.className] - Extra classes.
 * @param {React.ReactNode} props.children - Card content.
 * @param {object} [props.style] - Inline style overrides merged over the defaults.
 */
export default function Card({ clickable = false, className = '', children, style = {}, ...rest }) {
  // Lift on hover as the affordance; the surface color stays unchanged (no
  // brightness filter) so cards never read as "greyed out" on hover.
  const clickableClasses = clickable ? 'cursor-pointer transform hover:-translate-y-1 duration-slow' : '';

  // When the whole card acts as a button (an onClick handler is passed), make it
  // keyboard-operable: expose it as role="button", make it focusable, show the
  // shared focus ring, and activate on Enter/Space. Callers can still override
  // any of these via props.
  const isButton = typeof rest.onClick === 'function' && rest.role === undefined;
  const buttonProps = isButton
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            rest.onClick(event);
          }
          rest.onKeyDown?.(event);
        },
      }
    : {};

  const props = {
    className: `relative rounded-3xl bg-surface transition-all overflow-hidden ${clickableClasses} ${
      isButton ? 'focus-ring' : ''
    } ${className}`.trim(),
    style,
    ...rest,
    ...buttonProps,
  };

  return React.createElement('div', props, children);
}

Card.propTypes = {
  clickable: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
  style: PropTypes.object,
};
