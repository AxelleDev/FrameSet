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
  // Lift on hover as the affordance; the surface color stays unchanged (no
  // brightness filter) so cards never read as "greyed out" on hover.
  const clickableClasses = clickable ? 'cursor-pointer transform hover:-translate-y-1 duration-slow' : '';

  const props = {
    className: `relative rounded-3xl bg-surface transition-all overflow-hidden ${clickableClasses} ${className}`.trim(),
    style,
    ...rest,
  };

  return React.createElement('div', props, children);
}
