import React from 'react';
import PropTypes from 'prop-types';

const SIZES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
};

// The one loading-spinner mark used everywhere in the app (buttons, page
// loaders, in-progress row actions). Color follows `currentColor` by default
// so it inherits the surrounding text color (e.g. white inside a primary
// button); pass a text-* class to pin a specific color for standalone use.
export default function Spinner({ size = 'md', className = '' }) {
  return (
    <svg
      className={`${SIZES[size] || SIZES.md} animate-spin ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};
