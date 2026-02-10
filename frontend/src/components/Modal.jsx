// Modale generique reutilisable.
import React from 'react';

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
      <div className={panelClassName}>
        {(title || subtitle || showClose) && (
          <div className="flex items-start justify-between mb-6">
            <div>
              {title && <h4 className="text-xl font-medium text-primary">{title}</h4>}
              {subtitle && <p className="text-sm text-blue">{subtitle}</p>}
            </div>
            {showClose && (
              <button onClick={onClose} className="text-blue hover:text-pink transition" aria-label="Fermer">
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
