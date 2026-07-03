import React from 'react';
import PropTypes from 'prop-types';

// User avatar showing initials on a tinted circle. Sizing/styling come via `className`
// so one component fits both the small sidebar and large profile avatars.
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

Avatar.propTypes = {
  initials: PropTypes.string,
  className: PropTypes.string,
};
