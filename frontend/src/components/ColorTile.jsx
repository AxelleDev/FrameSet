import React, { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CopyBadge from './CopyBadge';
import { getColorFormats } from '../utils/colorFormats';

/**
 * The one color-swatch shape used everywhere a palette color is shown:
 * Landing's mockup, ProjectPalette's editor and the public Shared reference
 * sheet. The swatch itself is always a true square (sized off its own width
 * via `aspect-square`, not squeezed by the caption below it), with the
 * name/hex centered underneath — so a color never looks like a different
 * shape or size depending on the page.
 *
 * With `onCopyValue`, the hex caption becomes a menu of copyable formats
 * (HEX, RGB, HSL, HSB — the values drawing apps expose); the swatch's own
 * copy overlay keeps the one-click "copy hex" fast path.
 */
const ColorTile = React.forwardRef(function ColorTile(
  {
    hex,
    name,
    onCopy,
    copied = false,
    onCopyValue,
    copiedValue = null,
    overlay,
    className = '',
    ...rest
  },
  ref,
) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  // Close the formats menu when clicking anywhere else on the page.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && event.target !== triggerRef.current) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  const closeMenu = ({ refocus = false } = {}) => {
    setIsMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // Escape closes and refocuses the trigger; arrows cycle through the rows.
  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeMenu({ refocus: true });
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(currentIndex + step + items.length) % items.length].focus();
  };
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
      <div className="mt-4 text-center relative">
        <p className="text-sm font-semibold text-primary truncate" title={name}>
          {name}
        </p>
        {onCopyValue ? (
          <>
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-controls={isMenuOpen ? menuId : undefined}
              aria-label={`Copy ${hex} in another format`}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((open) => !open);
              }}
              onKeyDown={(e) => {
                // Escape must close the menu even while focus is still on the
                // trigger (opening by click leaves focus here, not in the menu).
                if (e.key === 'Escape' && isMenuOpen) {
                  e.stopPropagation();
                  closeMenu({ refocus: true });
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 hover:opacity-100 group-hover:opacity-100 transition-opacity rounded focus-ring"
            >
              {hex}
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                focusable="false"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isMenuOpen && (
              /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- keydown implements the menu's Escape/arrow-key pattern, not a click substitute */
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={`Copy formats for ${hex}`}
                onKeyDown={handleMenuKeyDown}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-popover min-w-max rounded-xl bg-surface p-1 shadow-lg ring-1 ring-primary/10 text-left"
              >
                {getColorFormats(hex).map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyValue(format.value);
                      closeMenu({ refocus: true });
                    }}
                    className="w-full flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-xs text-primary hover:bg-blue/10 focus-ring"
                  >
                    <span className="font-semibold text-primary/60">{format.label}</span>
                    <span className="font-mono">
                      {copiedValue === format.value ? 'Copied!' : format.value}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity">
            {hex}
          </p>
        )}
      </div>
    </div>
  );
});

ColorTile.propTypes = {
  hex: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onCopy: PropTypes.func,
  copied: PropTypes.bool,
  onCopyValue: PropTypes.func,
  copiedValue: PropTypes.string,
  overlay: PropTypes.node,
  className: PropTypes.string,
};

export default ColorTile;
