import React from 'react';
import PropTypes from 'prop-types';
import AppModal from './AppModal';

/**
 * AppModal variant for forms: adds a decorative corner blob, optional title,
 * and a content area kept above the decoration via z-index.
 */
export default function FormModal({
  isOpen,
  onClose,
  title,
  children,
  panelClassName = 'max-w-sm',
  showClose = false,
  bodyClassName = '',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50',
  titleClassName = 'text-xl font-medium text-primary mb-6'
}) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      showClose={showClose}
      panelClassName={panelClassName}
      ariaLabelledby={title ? 'form-modal-title' : undefined}
    >
      <div className={decorationClassName}></div>
      {title ? (
        <h3 id="form-modal-title" className={`${titleClassName} relative z-10`.trim()}>{title}</h3>
      ) : null}
      <div className={`relative z-10 ${bodyClassName}`.trim()}>{children}</div>
    </AppModal>
  );
}

FormModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  panelClassName: PropTypes.string,
  showClose: PropTypes.bool,
  bodyClassName: PropTypes.string,
  decorationClassName: PropTypes.string,
  titleClassName: PropTypes.string,
};
