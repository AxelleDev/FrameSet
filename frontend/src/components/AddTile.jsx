// "Add" tile used to create a new item.
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Dashed placeholder tile that triggers creation of a new item when clicked.
 *
 * @param {object} props
 * @param {Function} props.onClick - Click handler invoked to start creation.
 * @param {string} [props.label] - Visible label (defaults to "Add").
 * @param {string} [props.className] - Extra classes for the outer button (sizing, layout).
 * @param {string} [props.labelClassName] - Classes applied to the label text.
 */
export default function AddTile({
  onClick,
  label = 'Add',
  className = '',
  labelClassName = 'text-sm font-medium text-primary'
}) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-3xl border-2 border-dashed border-secondary flex flex-col items-center justify-center cursor-pointer hover:border-blue hover:bg-blue/5 transition-all focus-ring ${className}`.trim()}
    >
      <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:text-blue group-hover:bg-blue/10 transition-colors mb-3 transition-transform group-hover:scale-110">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className={labelClassName}>{label}</span>
    </button>
  );
}

AddTile.propTypes = {
  onClick: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
};
