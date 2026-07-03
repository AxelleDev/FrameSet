// Standard confirmation dialog.
import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import FormModal from './FormModal';
import ModalActions from './ModalActions';
import TextInput from './TextInput';

// Confirmation modal with an optional "type to confirm" safeguard: when `confirmationWord`
// is set, the primary action stays disabled until the user types the matching word.
export default function ConfirmDialog({
  isOpen,
  title,
  subtitle = '',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmClassName = '',
  primaryVariant = 'danger',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50',
  confirmationWord = '',
  confirmationInputLabel = 'Confirmation word',
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
            <p className="mt-2 text-xs text-danger">The value you entered doesn't match.</p>
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
        primaryVariant={primaryVariant}
      />
    </FormModal>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  message: PropTypes.node,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  confirmClassName: PropTypes.string,
  primaryVariant: PropTypes.string,
  decorationClassName: PropTypes.string,
  confirmationWord: PropTypes.string,
  confirmationInputLabel: PropTypes.string,
  confirmationInputPlaceholder: PropTypes.string,
};
