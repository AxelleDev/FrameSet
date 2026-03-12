// Dialogue de confirmation standard.
import React from 'react';
import FormModal from './FormModal';
import ModalActions from './ModalActions';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmClassName = 'bg-pink text-white hover:bg-pink/10',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-pink/10 rounded-full -mr-16 -mt-16 opacity-50'
}) {
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onCancel}
      showClose={false}
      panelClassName="max-w-md"
      title={title}
      titleClassName="text-xl font-light text-primary mb-3"
      decorationClassName={decorationClassName}
    >
      <p className="text-sm text-primary mb-6">{message}</p>
      <ModalActions
        secondaryLabel={cancelLabel}
        primaryLabel={confirmLabel}
        onSecondary={onCancel}
        onPrimary={onConfirm}
        primaryDisabled={false}
        primaryClassName={confirmClassName}
        primaryVariant="secondary"
      />
    </FormModal>
  );
}
