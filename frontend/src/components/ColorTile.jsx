import React, { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import CopyBadge from './CopyBadge';
import { CheckCircleIcon } from './icons';
import { getColorFormats, formatColor } from '../utils/colorFormats';

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
    displayFormat = 'hex',
    dragHandleProps,
    dragging = false,
    overlay,
    className = '',
    ...rest
  },
  ref,
) {
  // The caption value shown under the name, in the chosen display format.
  const displayValue = formatColor(hex, displayFormat);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  // Delays closing the menu after a format is copied, so the "Copied!"
  // confirmation stays visible for a moment instead of the menu vanishing
  // instantly (which read as "nothing happened").
  const copyCloseTimer = useRef(null);

  // Clear any pending auto-close if the tile unmounts.
  useEffect(() => () => clearTimeout(copyCloseTimer.current), []);

  // Close the formats menu when clicking anywhere else on the page.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && event.target !== triggerRef.current) {
        clearTimeout(copyCloseTimer.current);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  const closeMenu = ({ refocus = false } = {}) => {
    clearTimeout(copyCloseTimer.current);
    setIsMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // Copies the picked format, keeps the menu open long enough for the "Copied!"
  // confirmation to register, then closes it.
  const handleFormatPick = (value) => {
    onCopyValue(value);
    clearTimeout(copyCloseTimer.current);
    copyCloseTimer.current = setTimeout(() => closeMenu({ refocus: true }), 1000);
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
  // Split the drag props: the SQUARE is the grab handle (draggable + drag
  // start/end), but the WHOLE tile is the drop zone (dragover/drop). So you grab
  // from the swatch, yet can release anywhere on the tile without the reorder
  // snapping back — while the caption stays clickable/focusable.
  const { draggable, onDragStart, onDragEnd, onDragOver, onDrop } = dragHandleProps || {};
  const isDraggable = Boolean(dragHandleProps);

  return (
    <div
      ref={ref}
      className={`group relative flex flex-col outline-none ${className}`.trim()}
      onDragOver={onDragOver}
      onDrop={onDrop}
      {...rest}
    >
      {/* No `overflow-hidden` on purpose: with `rounded-3xl` and the hover
          transform, Chrome drops the rounded clip mid-animation and the
          copy overlay flashes square corners. `aspect-square` (not `flex-1`)
          so the swatch stays a true square regardless of the caption's
          height, instead of being squeezed into a rectangle to fit it. */}
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`w-full aspect-square rounded-3xl relative transition-transform duration-slow group-hover:-translate-y-2 ${
          isDraggable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`.trim()}
        style={{ backgroundColor: hex }}
      >
        {overlay}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${displayValue}`}
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
              {displayValue}
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
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={`Copy formats for ${hex}`}
                /* Programmatically focusable, per the ARIA menu pattern (focus
                   itself lives on the menuitem buttons, moved by the arrows). */
                tabIndex={-1}
                onKeyDown={handleMenuKeyDown}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-popover min-w-max rounded-xl bg-surface p-1 shadow-lg ring-1 ring-primary/10 text-left"
              >
                {getColorFormats(hex).map((format) => {
                  const justCopied = copiedValue === format.value;
                  return (
                    <button
                      key={format.id}
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFormatPick(format.value);
                      }}
                      className={`w-full flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-xs focus-ring ${
                        justCopied ? 'bg-success/10 text-success' : 'text-primary hover:bg-blue/10'
                      }`}
                    >
                      <span
                        className={`font-semibold ${justCopied ? 'text-success' : 'text-primary/60'}`}
                      >
                        {format.label}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        {justCopied ? (
                          <>
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Copied!
                          </>
                        ) : (
                          format.value
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-primary font-mono mt-0.5 uppercase tracking-wide opacity-70 group-hover:opacity-100 transition-opacity">
            {displayValue}
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
  // Display format for the caption value: 'hex' | 'rgb' | 'hsl' | 'hsb'.
  displayFormat: PropTypes.string,
  // Drag props (from useDragReorder) applied to the color square only, so the
  // caption stays interactive. Also drives the grab/grabbing cursor.
  dragHandleProps: PropTypes.object,
  dragging: PropTypes.bool,
  overlay: PropTypes.node,
  className: PropTypes.string,
};

export default ColorTile;
