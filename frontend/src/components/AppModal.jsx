// Modal wrapper applying the app's default styling.
import React from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';

// Default overlay/panel styling shared across application modals.
const DEFAULT_OVERLAY_CLASS = 'p-4 bg-black/40 backdrop-blur-sm animate-fade-in';
// overflow-hidden clips the decorative corner blob horizontally, while
// overflow-y-auto + max-h let tall content scroll instead of being cropped.
const DEFAULT_PANEL_CLASS = 'bg-surface rounded-3xl p-6 sm:p-8 w-full relative overflow-hidden overflow-y-auto max-h-[90dvh]';

// Append caller-provided classes onto the defaults when present.
const mergeClasses = (base, extra) => {
  if (!extra) return base;
  return `${base} ${extra}`.trim();
};

/**
 * Pre-styled wrapper around the generic Modal applying the app's look and feel.
 * Forwards any extra props through to Modal.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is rendered.
 * @param {Function} props.onClose - Close handler.
 * @param {React.ReactNode} props.children - Modal content.
 * @param {string} [props.overlayClassName] - Extra overlay classes merged with defaults.
 * @param {string} [props.panelClassName] - Extra panel classes merged with defaults.
 * @param {boolean} [props.showClose] - Whether to render the built-in close button.
 */
export default function AppModal({
  isOpen,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  showClose = false,
  ...rest
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showClose={showClose}
      overlayClassName={mergeClasses(DEFAULT_OVERLAY_CLASS, overlayClassName)}
      panelClassName={mergeClasses(DEFAULT_PANEL_CLASS, panelClassName)}
      {...rest}
    >
      {children}
    </Modal>
  );
}

AppModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  children: PropTypes.node,
  overlayClassName: PropTypes.string,
  panelClassName: PropTypes.string,
  showClose: PropTypes.bool,
};
