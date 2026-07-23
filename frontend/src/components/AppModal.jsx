// Modal wrapper applying the app's default styling.
import React from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';

const DEFAULT_OVERLAY_CLASS = 'p-4 bg-black/40 backdrop-blur-sm animate-fade-in';
// overflow-hidden clips the decorative corner blob horizontally; overflow-y-auto + max-h
// let tall content scroll instead of being cropped.
const DEFAULT_PANEL_CLASS =
  'bg-surface rounded-3xl p-6 sm:p-8 w-full relative overflow-hidden overflow-y-auto max-h-[90dvh]';

const mergeClasses = (base, extra) => {
  if (!extra) return base;
  return `${base} ${extra}`.trim();
};

// Pre-styled wrapper around the generic Modal; forwards extra props through to Modal.
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
