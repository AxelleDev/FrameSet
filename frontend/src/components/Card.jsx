import React from 'react';
import PropTypes from 'prop-types';

// Generic surface container; adds hover/lift affordances when clickable. Extra props spread onto the div.
export default function Card({ clickable = false, className = '', children, style = {}, ...rest }) {
  // Lift on hover; surface color stays unchanged (no brightness filter) so cards never look "greyed out".
  const clickableClasses = clickable
    ? 'cursor-pointer transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] duration-slow'
    : '';

  // When the card carries an onClick, make it keyboard-operable (role=button, focusable,
  // focus ring, Enter/Space activation). Callers can override via props.
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
    className:
      `relative rounded-3xl bg-surface transition-all overflow-hidden ${clickableClasses} ${
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
