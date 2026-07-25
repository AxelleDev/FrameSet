import React from 'react';
import PropTypes from 'prop-types';
import CopyBadge from './CopyBadge';

/**
 * The one color-swatch shape used everywhere a palette color is shown:
 * Landing's mockup, ProjectPalette's editor and the public Shared reference
 * sheet. The swatch itself is always a true square (sized off its own width
 * via `aspect-square`, not squeezed by the caption below it), with the
 * name/hex centered underneath — so a color never looks like a different
 * shape or size depending on the page.
 */
const ColorTile = React.forwardRef(function ColorTile(
  { hex, name, onCopy, copied = false, overlay, className = '', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`group relative flex flex-col outline-none ${className}`.trim()}
      {...rest}
    >
      {/* No `overflow-hidden` on purpose: with `rounded-3xl` and the hover
          transform, Chrome drops the rounded clip mid-animation and the
          copy overlay flashes square corners. `aspect-square` (not `flex-1`)
          so the swatch stays a true square regardless of the caption's
          height, instead of being squeezed into a rectangle to fit it. */}
      <div
        className="w-full aspect-square rounded-3xl relative transition-transform duration-slow group-hover:-translate-y-2"
        style={{ backgroundColor: hex }}
      >
        {overlay}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${hex}`}
            className="absolute inset-0 flex items-center justify-center rounded-3xl opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity bg-black/15 cursor-pointer z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            <CopyBadge isCopied={copied} />
          </button>
        )}
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm font-semibold text-primary truncate" title={name}>
          {name}
        </p>
        <p className="text-xs text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity">
          {hex}
        </p>
      </div>
    </div>
  );
});

ColorTile.propTypes = {
  hex: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onCopy: PropTypes.func,
  copied: PropTypes.bool,
  overlay: PropTypes.node,
  className: PropTypes.string,
};

export default ColorTile;
