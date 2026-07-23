import React from 'react';
import PropTypes from 'prop-types';

// A labeled horizontal rule, e.g. splitting a form from an alternate action
// ("or continue with Google"). Purely decorative — hidden from assistive tech.
export default function Divider({ label = 'or', className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()} aria-hidden="true">
      <span className="h-px flex-1 bg-primary/10" />
      <span className="text-xs uppercase tracking-widest text-primary/50">{label}</span>
      <span className="h-px flex-1 bg-primary/10" />
    </div>
  );
}

Divider.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
};
