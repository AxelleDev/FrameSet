import React from 'react';

/**
 * Canonical text control for the whole app: input, select or textarea sharing
 * the same fill, border, radius and focus ring. Using it everywhere guarantees
 * every field looks identical.
 *
 * @param {object} props
 * @param {'input'|'select'|'textarea'} [props.as] - Underlying element to render.
 * @param {boolean} [props.mono] - Render the value in a monospace, uppercased font (e.g. hex codes).
 * @param {string} [props.className] - Extra classes (e.g. `flex-1`).
 * @param {boolean} [props.disabled] - Disable the control.
 */
const BASE =
  'w-full px-4 py-3 bg-blue/10 rounded-xl text-primary ' +
  'placeholder:text-primary/40 transition-all ' +
  'focus:outline-none focus:ring-2 focus:ring-blue focus:bg-white ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export default function TextInput({ as = 'input', mono = false, className = '', ...rest }) {
  const Tag = as;
  const classes = `${BASE} ${mono ? 'font-mono uppercase' : ''} ${className}`
    .replace(/\s+/g, ' ')
    .trim();
  return <Tag className={classes} {...rest} />;
}
