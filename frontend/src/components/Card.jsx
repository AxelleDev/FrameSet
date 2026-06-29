import React from 'react';

/**
 * Generic surface container with rounded corners, subtle shadow and border.
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
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    ...style,
  };

  const props = {
    className: `relative rounded-2xl transition-all overflow-hidden ${clickableClasses} ${className}`.trim(),
    style: combinedStyle,
    ...rest,
  };

  return React.createElement('div', props, children);
}
