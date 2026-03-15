// Dialogue de confirmation standard.
import React, { useEffect, useId, useState } from 'react';
import FormModal from './FormModal';
import ModalActions from './ModalActions';

export default function ConfirmDialog({
  isOpen,
  title,
  subtitle = '',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmClassName = 'bg-pink text-white hover:bg-pink/10',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-pink/10 rounded-full -mr-16 -mt-16 opacity-50',
  confirmationWord = '',
  confirmationInputLabel = 'Mot de confirmation',
  confirmationInputPlaceholder = ''
}) {
  const [confirmationValue, setConfirmationValue] = useState('');
  const confirmationInputId = useId();

  useEffect(() => {
    if (isOpen) {
      setConfirmationValue('');
    }
  }, [isOpen]);

  const requiresConfirmationWord = Boolean(confirmationWord);
  const normalizedConfirmationValue = confirmationValue.trim();
  const isConfirmationValid = !requiresConfirmationWord || normalizedConfirmationValue === confirmationWord;
  const showConfirmationError = requiresConfirmationWord
    && normalizedConfirmationValue.length > 0
    && !isConfirmationValid;

  const handleConfirm = () => {
    if (!isConfirmationValid) return;
    onConfirm?.();
  };

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
      {subtitle ? <p className="text-sm text-blue mb-2">{subtitle}</p> : null}
      <p className="text-sm text-primary mb-4">{message}</p>

      {requiresConfirmationWord ? (
        <div className="mb-4">
          <label htmlFor={confirmationInputId} className="block text-xs font-semibold text-primary uppercase tracking-wider mb-2">
            {confirmationInputLabel}
          </label>
          <input
            id={confirmationInputId}
            type="text"
            value={confirmationValue}
            onChange={(event) => setConfirmationValue(event.target.value)}
            placeholder={confirmationInputPlaceholder || confirmationWord}
            autoComplete="off"
            className="w-full px-4 py-3 bg-blue/10 border border-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-pink focus:bg-white transition-all text-primary"
          />
          {showConfirmationError ? (
            <p className="mt-2 text-xs text-pink">La valeur saisie ne correspond pas.</p>
          ) : null}
        </div>
      ) : null}

      <ModalActions
        secondaryLabel={cancelLabel}
        primaryLabel={confirmLabel}
        onSecondary={onCancel}
        onPrimary={handleConfirm}
        primaryDisabled={!isConfirmationValid}
        primaryClassName={confirmClassName}
        primaryVariant="secondary"
      />
    </FormModal>
  );
}
