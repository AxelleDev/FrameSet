import React from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
import Badge from './Badge';

/**
 * The one "graphic standard" card shape used everywhere a brush or typography
 * norm is shown: Landing's mockup, ProjectNorms' editor and the public Shared
 * reference sheet. A Card with a category Badge, a title, a big value/unit
 * baseline line, an optional detail line and a preview strip — callers only
 * plug in what differs (value, detail, preview), the shell stays identical
 * everywhere so a standard never looks like a different product depending on
 * the page.
 */
export default function StandardCard({
  category,
  badgeColor,
  title,
  value,
  valueTitle,
  valueTruncate = false,
  unit,
  detail,
  preview,
  actions,
  className = '',
}) {
  return (
    <Card className={`p-6 relative group flex flex-col justify-between h-full ${className}`.trim()}>
      {actions}
      <div className="mb-4">
        <Badge color={badgeColor} className="mb-2">
          {category}
        </Badge>
        <h3 className="text-sm font-medium text-primary uppercase tracking-widest mb-1">{title}</h3>
        <div className={`flex items-baseline mb-2 ${valueTruncate ? 'min-w-0' : ''}`.trim()}>
          <span
            className={`text-2xl font-light text-primary mr-1 ${valueTruncate ? 'truncate min-w-0' : ''}`.trim()}
            title={valueTitle}
          >
            {value}
          </span>
          {unit && <span className="text-base text-blue font-medium shrink-0">{unit}</span>}
        </div>
        {detail}
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="h-16 bg-blue/5 rounded-xl flex items-center justify-center relative overflow-hidden">
          {preview}
        </div>
      </div>
    </Card>
  );
}

StandardCard.propTypes = {
  category: PropTypes.node.isRequired,
  badgeColor: PropTypes.oneOf(['primary', 'blue', 'danger']),
  title: PropTypes.node.isRequired,
  value: PropTypes.node,
  valueTitle: PropTypes.string,
  valueTruncate: PropTypes.bool,
  unit: PropTypes.node,
  detail: PropTypes.node,
  preview: PropTypes.node,
  actions: PropTypes.node,
  className: PropTypes.string,
};
