import React from 'react';
import PropTypes from 'prop-types';

// The "nothing here yet" layout shared by every inline empty/not-found state
// in the app (Dashboard's zero-projects state, the Shared reference sheet's
// empty sheet, a project that can't be found): centered title, muted
// description, optional action.
export default function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`text-center ${className}`.trim()}>
      {title && <h2 className="text-lg font-medium text-primary mb-2">{title}</h2>}
      {description && (
        <p className={`text-sm text-primary/60 max-w-md mx-auto ${action ? 'mb-6' : ''}`.trim()}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  action: PropTypes.node,
  className: PropTypes.string,
};
