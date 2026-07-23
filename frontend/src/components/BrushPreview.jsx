import React from 'react';
import PropTypes from 'prop-types';

/** The brush preview strip content: a bar sized/opacity'd to the norm, plus
    its brush name — the exact same rendering used by ProjectNorms, the
    Shared reference sheet and Landing's mockup (via StandardCard). */
export default function BrushPreview({ value, opacity, brushName }) {
  const numericOpacity = typeof opacity === 'number' ? opacity : opacity ? parseFloat(opacity) : 1;
  return (
    <div className="flex flex-col items-center justify-center w-full px-4">
      <div
        className="w-16 rounded-full mb-1 bg-primary"
        style={{
          height: `${value}px`,
          minHeight: '1px',
          backgroundColor: 'rgb(var(--color-primary))',
          opacity: numericOpacity,
        }}
      ></div>
      <span className="text-[10px] text-blue font-bold uppercase tracking-wider">
        {brushName || 'Brush'}
      </span>
    </div>
  );
}

BrushPreview.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  opacity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  brushName: PropTypes.string,
};
