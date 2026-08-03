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

// filled fills the pin head when the project is pinned; unpinned uses the plain outline.
export function PinIcon({ className = 'w-4 h-4', filled = false }) {
  return (
    <svg className={className} {...iconProps} fill={filled ? 'currentColor' : 'none'}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 4.5h6l-.75 6L18 13.5v1.5h-5.25V21l-.75 1.5-.75-1.5v-6H6v-1.5l3.75-3z"
      />
    </svg>
  );
}
PinIcon.propTypes = { className: PropTypes.string, filled: PropTypes.bool };

// Password checklist: a met requirement (check-circle, lucide-style).
export function CheckCircleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
CheckCircleIcon.propTypes = { className: PropTypes.string };

// Password checklist: an unmet requirement (plain circle, lucide-style).
export function CircleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
    </svg>
  );
}
CircleIcon.propTypes = { className: PropTypes.string };

export function EyedropperIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} {...iconProps}>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15 11.25 1.5 1.5.75-.75V8.758l2.276-.61a3 3 0 1 0-3.675-3.675l-.61 2.277H12l-.75.75 1.5 1.5M15 11.25l-8.47 8.47c-.34.34-.8.53-1.28.53s-.94.19-1.28.53l-.97.97-.75-.75.97-.97c.34-.34.53-.8.53-1.28s.19-.94.53-1.28L12.75 9M15 11.25 12.75 9"
      />
    </svg>
  );
}
EyedropperIcon.propTypes = { className: PropTypes.string };
