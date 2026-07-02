import React from 'react';
import PropTypes from 'prop-types';

// Title + optional subtitle on the left, optional right-aligned `actions` slot.
export default function PageHeader({ title, subtitle, subtitleClassName = '', actions }) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-4 animate-fade-in">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-primary break-words">{title}</h1>
        {subtitle && (
          <p className={`text-sm text-primary/60 mt-2 max-w-2xl ${subtitleClassName}`.trim()}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  subtitleClassName: PropTypes.string,
  actions: PropTypes.node,
};
