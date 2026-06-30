// Standard confirmation dialog.
import React, { useEffect, useId, useState } from 'react';
import FormModal from './FormModal';
import ModalActions from './ModalActions';
import TextInput from './TextInput';

/**
 * Confirmation modal with optional "type to confirm" safeguard for destructive
 * actions. When `confirmationWord` is set, the primary action stays disabled
 * until the user types the matching word.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is shown.
 * @param {string} props.title - Dialog title.
 * @param {string} [props.subtitle] - Optional subtitle line.
 * @param {React.ReactNode} props.message - Main message/body.
 * @param {string} [props.confirmLabel] - Primary button label.
 * @param {string} [props.cancelLabel] - Secondary button label.
 * @param {Function} props.onConfirm - Called when the user confirms.
 * @param {Function} props.onCancel - Called when the user cancels/closes.
 * @param {string} [props.confirmClassName] - Extra classes for the confirm button.
 * @param {string} [props.decorationClassName] - Classes for the decorative corner blob.
 * @param {string} [props.confirmationWord] - If set, requires the user to type this word to confirm.
 * @param {string} [props.confirmationInputLabel] - Label for the confirmation input.
 * @param {string} [props.confirmationInputPlaceholder] - Placeholder for the confirmation input.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  subtitle = '',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  confirmClassName = '',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50',
  confirmationWord = '',
  confirmationInputLabel = 'Mot de confirmation',
  confirmationInputPlaceholder = ''
}) {
  const [confirmationValue, setConfirmationValue] = useState('');
  const confirmationInputId = useId();

  // Reset the confirmation input each time the dialog reopens.
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

  // Block confirmation while the required word does not match.
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
      titleClassName="text-xl font-medium text-primary mb-3"
      decorationClassName={decorationClassName}
    >
      {subtitle ? <p className="text-sm text-primary/60 mb-2">{subtitle}</p> : null}
      <p className="text-sm text-primary mb-4">{message}</p>

      {requiresConfirmationWord ? (
        <div className="mb-4">
          <label htmlFor={confirmationInputId} className="block text-sm font-medium text-primary mb-2">
            {confirmationInputLabel}
          </label>
          <TextInput
            id={confirmationInputId}
            type="text"
            value={confirmationValue}
            onChange={(event) => setConfirmationValue(event.target.value)}
            placeholder={confirmationInputPlaceholder || confirmationWord}
            autoComplete="off"
          />
          {showConfirmationError ? (
            <p className="mt-2 text-xs text-danger">La valeur saisie ne correspond pas.</p>
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
        primaryVariant="danger"
      />
    </FormModal>
  );
}
