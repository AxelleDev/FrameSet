import React from 'react';

/**
 * User avatar showing initials on a soft tinted circle. Sizing and any extra
 * styling (hover, etc.) are passed via `className` so the same component fits
 * the small sidebar avatar and the large profile one.
 *
 * @param {object} props
 * @param {string} props.initials - Initials to display (e.g. "AT").
 * @param {string} [props.className] - Size + extra classes (e.g. "w-28 h-28 text-4xl").
 */
export default function Avatar({ initials, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-blue/15 text-blue font-semibold flex-shrink-0 ${className}`.trim()}
    >
      {initials}
    </span>
  );
}
