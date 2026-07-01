// Form modal with a decorative accent and title.
import React from 'react';
import PropTypes from 'prop-types';
import AppModal from './AppModal';

/**
 * AppModal variant tailored for forms: adds a decorative corner blob, an
 * optional title and a content area kept above the decoration via z-index.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is shown.
 * @param {Function} props.onClose - Close handler.
 * @param {string} [props.title] - Optional heading text.
 * @param {React.ReactNode} props.children - Form content.
 * @param {string} [props.panelClassName] - Extra panel classes (sizing).
 * @param {boolean} [props.showClose] - Whether to render the built-in close button.
 * @param {string} [props.bodyClassName] - Extra classes for the content wrapper.
 * @param {string} [props.decorationClassName] - Classes for the decorative blob.
 * @param {string} [props.titleClassName] - Classes for the title heading.
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
