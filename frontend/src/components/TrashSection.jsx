import React from 'react';
import PropTypes from 'prop-types';
import { DeleteIcon } from './icons';

// The "Trash" section heading + retention notice shown at the bottom of the
// Dashboard, Palette and Standards pages — same shape everywhere a trash list
// appears, only the row content (children) and the note wording differ.
export default function TrashSection({ id, count, note, children }) {
  return (
    <section className="mt-14" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-primary flex items-center">
        <DeleteIcon className="w-5 h-5 mr-2 text-blue shrink-0" />
        Trash
        <span className="ml-2 text-sm font-normal text-primary/50">({count})</span>
      </h2>
      <p className="text-xs text-primary/60 mt-1 mb-4">{note}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

TrashSection.propTypes = {
  id: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  note: PropTypes.node.isRequired,
  children: PropTypes.node,
};
