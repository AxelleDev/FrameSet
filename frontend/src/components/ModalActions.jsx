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
  primaryVariant = 'primary',
  secondaryVariant = 'ghost',
  className = ''
}) {
  return (
    <div className={`flex gap-3 mt-8 justify-end ${className}`.trim()}>
      <Button type={secondaryType} onClick={onSecondary} variant={secondaryVariant} className={secondaryClassName}>
        {secondaryLabel}
      </Button>
      <Button type={primaryType} onClick={onPrimary} disabled={primaryDisabled} variant={primaryVariant} className={primaryClassName}>
        {primaryLabel}
      </Button>
    </div>
  );
}
