// Modale generique reutilisable.
import React, { useRef, useEffect } from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  overlayClassName = 'bg-primary/40 backdrop-blur-sm',
  panelClassName = 'glass-card w-full max-w-lg rounded-3xl border border-white p-8 shadow-2xl',
  showClose = true,
  closeOnBackdrop = true
}) {
  const panelRef = useRef(null);
  // Focus trap : focus le panel à l'ouverture et empêche Tab de sortir
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
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

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 ${overlayClassName}`}
      onClick={handleBackdropClick}
    >
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
              {subtitle && <p className="text-sm text-blue">{subtitle}</p>}
            </div>
            {showClose && (
              <button onClick={onClose} className="text-blue hover:text-pink transition" aria-label="Fermer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
