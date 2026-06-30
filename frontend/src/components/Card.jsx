import React from 'react';

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
  const clickableClasses = clickable ? 'cursor-pointer hover:bg-white/80 transform hover:-translate-y-1 duration-300' : '';

  const combinedStyle = {
    backgroundColor: 'white',
    border: '1px solid rgba(60, 61, 72, 0.06)',
    ...style,
  };

  const props = {
    className: `relative rounded-3xl transition-all overflow-hidden ${clickableClasses} ${className}`.trim(),
    style: combinedStyle,
    ...rest,
  };

  return React.createElement('div', props, children);
}
