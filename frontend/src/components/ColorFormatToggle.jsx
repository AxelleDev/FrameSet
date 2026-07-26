import React from 'react';
import PropTypes from 'prop-types';
import { COLOR_FORMATS } from '../utils/colorFormats';

/**
 * Compact segmented control to pick how palette colors are displayed
 * (HEX / RGB / HSL / HSB). Controlled: `value` is a format id, `onChange`
 * receives the picked id. Purely a display preference — it never changes the
 * stored colors.
 */
export default function ColorFormatToggle({
  value,
  onChange,
  ariaLabel = 'Color display format',
  className = '',
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex rounded-xl bg-blue/10 p-1 ${className}`.trim()}
    >
      {COLOR_FORMATS.map((format) => {
        const isActive = value === format.id;
        return (
          <button
            key={format.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(format.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-ring ${
              isActive ? 'bg-surface text-primary shadow-sm' : 'text-primary/50 hover:text-primary'
            }`}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}

ColorFormatToggle.propTypes = {
  value: PropTypes.oneOf(COLOR_FORMATS.map((format) => format.id)),
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};
