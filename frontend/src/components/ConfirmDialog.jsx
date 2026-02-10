// Dialogue de confirmation standard.
import React from 'react';
import AppModal from './AppModal';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmClassName = 'bg-pink text-primary hover:bg-pink/10'
}) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onCancel}
      showClose={false}
      panelClassName="max-w-md"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink/10 rounded-full -mr-16 -mt-16 opacity-50"></div>
      <h3 className="text-xl font-light text-primary mb-3 relative z-10">{title}</h3>
      <p className="text-sm text-primary mb-6 relative z-10">{message}</p>

      <div className="flex gap-3 mt-4 relative z-10">
        <button
          onClick={onCancel}
          className="flex-1 py-3 text-primary font-medium hover:bg-blue/10 rounded-xl transition-colors"
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-3 font-medium rounded-xl hover:shadow-lg transition-all ${confirmClassName}`}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </AppModal>
  );
}
