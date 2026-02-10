import React from 'react';

export default function ModalActions({
  primaryLabel,
  secondaryLabel = 'Annuler',
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  primaryClassName = 'bg-blue text-primary hover:bg-pink/10 hover:shadow-lg',
  secondaryClassName = 'text-primary hover:bg-blue/10',
  primaryType = 'button',
  secondaryType = 'button',
  className = ''
}) {
  return (
    <div className={`flex gap-3 mt-8 ${className}`.trim()}>
      <button
        type={secondaryType}
        onClick={onSecondary}
        className={`flex-1 py-3 font-medium rounded-xl transition-colors ${secondaryClassName}`.trim()}
      >
        {secondaryLabel}
      </button>
      <button
        type={primaryType}
        onClick={onPrimary}
        disabled={primaryDisabled}
        className={`flex-1 py-3 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${primaryClassName}`.trim()}
      >
        {primaryLabel}
      </button>
    </div>
  );
}
