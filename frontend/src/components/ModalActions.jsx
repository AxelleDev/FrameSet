// Actions standard pour modales.
import React from 'react';
import Button from './Button';

export default function ModalActions({
  primaryLabel,
  secondaryLabel = 'Annuler',
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  primaryClassName = '',
  secondaryClassName = '',
  primaryType = 'button',
  secondaryType = 'button',
  className = ''
}) {
  return (
    <div className={`flex gap-3 mt-8 justify-end ${className}`.trim()}>
      <Button type={secondaryType} onClick={onSecondary} variant="ghost" className={secondaryClassName}>
        {secondaryLabel}
      </Button>
      <Button type={primaryType} onClick={onPrimary} disabled={primaryDisabled} variant="primary" className={primaryClassName}>
        {primaryLabel}
      </Button>
    </div>
  );
}
