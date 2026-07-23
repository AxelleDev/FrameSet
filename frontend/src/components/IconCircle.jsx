import React from 'react';
import PropTypes from 'prop-types';

// The blue icon-in-a-circle badge used atop feature/export cards (ProjectExport,
// Landing's mockups) — same size, color and spacing everywhere it appears.
export default function IconCircle({ children, className = '' }) {
  return (
    <div
      className={`h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

IconCircle.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
