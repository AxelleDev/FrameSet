// Dialogue de confirmation standard.
import React from 'react';
import AppModal from './AppModal';
import ModalActions from './ModalActions';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmClassName = 'bg-pink text-white hover:bg-pink/10'
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

      <div className="relative z-10">
        <ModalActions
          secondaryLabel={cancelLabel}
          primaryLabel={confirmLabel}
          onSecondary={onCancel}
          onPrimary={onConfirm}
          primaryDisabled={false}
          primaryClassName={confirmClassName}
          primaryVariant="secondary"
        />
      </div>
    </AppModal>
  );
}
