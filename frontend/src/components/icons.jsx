// Shared inline SVG icons. Decorative by default (aria-hidden), since they sit inside
// labelled controls (e.g. ActionIconButton's aria-label). Extracted to stop copy-pasting
// the same paths across Dashboard / ProjectNorms / ProjectPalette.
import React from 'react';
import PropTypes from 'prop-types';

const iconProps = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  'aria-hidden': true,
  focusable: false,
};

export function EditIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z"
      />
    </svg>
  );
}
EditIcon.propTypes = { className: PropTypes.string };

export function DuplicateIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}
DuplicateIcon.propTypes = { className: PropTypes.string };

export function DeleteIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
DeleteIcon.propTypes = { className: PropTypes.string };
