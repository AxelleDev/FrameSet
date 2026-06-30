// Standard action buttons for modals.
import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';

/**
 * Right-aligned secondary/primary button pair for modal footers.
 *
 * @param {object} props
 * @param {React.ReactNode} props.primaryLabel - Primary button label.
 * @param {React.ReactNode} [props.secondaryLabel] - Secondary button label (defaults to "Annuler").
 * @param {Function} props.onPrimary - Primary button click handler.
 * @param {Function} props.onSecondary - Secondary button click handler.
 * @param {boolean} [props.primaryDisabled] - Disable the primary button.
 * @param {string} [props.primaryClassName] - Extra classes for the primary button.
 * @param {string} [props.secondaryClassName] - Extra classes for the secondary button.
 * @param {string} [props.primaryType] - Native type for the primary button.
 * @param {string} [props.secondaryType] - Native type for the secondary button.
 * @param {string} [props.primaryVariant] - Button variant for the primary button.
 * @param {string} [props.secondaryVariant] - Button variant for the secondary button.
 * @param {string} [props.className] - Extra classes for the container.
 */
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

ModalActions.propTypes = {
  primaryLabel: PropTypes.node,
  secondaryLabel: PropTypes.node,
  onPrimary: PropTypes.func,
  onSecondary: PropTypes.func,
  primaryDisabled: PropTypes.bool,
  primaryClassName: PropTypes.string,
  secondaryClassName: PropTypes.string,
  primaryType: PropTypes.string,
  secondaryType: PropTypes.string,
  primaryVariant: PropTypes.string,
  secondaryVariant: PropTypes.string,
  className: PropTypes.string,
};
