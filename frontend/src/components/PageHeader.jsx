// Page header with title and optional subtitle.
import React from 'react';

/**
 * Standard page heading block with a title and optional subtitle.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title - Page title.
 * @param {React.ReactNode} [props.subtitle] - Optional subtitle/description.
 * @param {string} [props.subtitleClassName] - Extra classes for the subtitle text.
 */
export default function PageHeader({ title, subtitle, subtitleClassName = '' }) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-light tracking-tight text-primary">{title}</h2>
        {subtitle && (
          <p className={`text-sm text-primary/60 mt-2 max-w-2xl ${subtitleClassName}`.trim()}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
