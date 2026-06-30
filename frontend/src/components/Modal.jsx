// Generic reusable modal.
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

/**
 * Low-level modal primitive: renders an overlay + focusable panel, supports
 * backdrop-click close, an optional header (title/subtitle/close button) and a
 * focus trap that keeps Tab navigation within the panel.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is rendered (returns null when false).
 * @param {Function} props.onClose - Close handler invoked by backdrop click and close button.
 * @param {string} [props.title] - Optional header title (also wires aria-labelledby).
 * @param {string} [props.subtitle] - Optional header subtitle.
 * @param {React.ReactNode} props.children - Modal body content.
 * @param {string} [props.overlayClassName] - Overlay styling classes.
 * @param {string} [props.panelClassName] - Panel styling classes.
 * @param {boolean} [props.showClose] - Whether to render the header close button.
 * @param {boolean} [props.closeOnBackdrop] - Whether clicking the backdrop closes the modal.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  overlayClassName = 'bg-black/40 backdrop-blur-sm',
  panelClassName = 'bg-surface w-full max-w-lg rounded-3xl p-8',
  showClose = true,
  closeOnBackdrop = true
}) {
  const panelRef = useRef(null);
  // Remembers the element focused before the modal opened, to restore it on close.
  const previouslyFocused = useRef(null);

  // Focus the panel on open, and restore focus to the opener when it closes so
  // keyboard users are not dropped back at the top of the page.
  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocused.current = document.activeElement;
    if (panelRef.current) {
      panelRef.current.focus();
    }
    return () => {
      const opener = previouslyFocused.current;
      if (opener && typeof opener.focus === 'function') {
        opener.focus();
      }
    };
  }, [isOpen]);

  // Keyboard handling: Escape closes the modal; Tab is trapped within the panel,
  // wrapping from last to first (and vice-versa with Shift).
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusableEls = panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const focusable = Array.prototype.slice.call(focusableEls);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Do not render anything while closed.
  if (!isOpen) return null;

  // Close only when the click originated on the overlay itself, not its children.
  const handleBackdropClick = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return createPortal(
    // Backdrop: clicking it closes the modal (mouse convenience). Keyboard users
    // close via Escape or the header close button, so no key handler is needed here.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className={`fixed inset-0 z-modal flex items-center justify-center px-4 ${overlayClassName}`}
      onClick={handleBackdropClick}
    >
      {/* The dialog panel owns the focus trap + Escape handling (keyboard support). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex="-1"
        ref={panelRef}
        onKeyDown={handleKeyDown}
      >
        {(title || subtitle || showClose) && (
          <div className="flex items-start justify-between mb-6">
            <div>
              {title && <h4 id="modal-title" className="text-xl font-medium text-primary">{title}</h4>}
              {subtitle && <p className="text-sm text-primary/60">{subtitle}</p>}
            </div>
            {showClose && (
              <button onClick={onClose} className="p-2 -m-2 rounded-lg text-blue hover:text-primary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue" aria-label="Fermer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  overlayClassName: PropTypes.string,
  panelClassName: PropTypes.string,
  showClose: PropTypes.bool,
  closeOnBackdrop: PropTypes.bool,
};
