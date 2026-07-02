import React from 'react';
import PropTypes from 'prop-types';

// Canonical text control (input/select/textarea) sharing one fill, radius and
// focus ring so every field looks identical. `mono` renders monospace+uppercase
// (e.g. hex codes).
// text-base (16px) is deliberate: on iOS Safari a font-size < 16px triggers
// browser auto-zoom when the field gains focus, which is jarring on mobile.
const BASE =
  'w-full px-4 py-3 text-base bg-blue/10 rounded-xl text-primary ' +
  'placeholder:text-primary/40 transition-all ' +
  'focus:outline-none focus:ring-2 focus:ring-blue focus:bg-surface ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export default function TextInput({ as = 'input', mono = false, className = '', ...rest }) {
  const Tag = as;
  const classes = `${BASE} ${mono ? 'font-mono uppercase' : ''} ${className}`
    .replace(/\s+/g, ' ')
    .trim();
  return <Tag className={classes} {...rest} />;
}

TextInput.propTypes = {
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  mono: PropTypes.bool,
  className: PropTypes.string,
};
