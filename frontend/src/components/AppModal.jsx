// Enveloppe de modale avec styles par defaut.
import React from 'react';
import Modal from './Modal';

const DEFAULT_OVERLAY_CLASS = 'p-4 bg-blue/20 backdrop-blur-sm animate-fade-in';
const DEFAULT_PANEL_CLASS = 'bg-white rounded-3xl shadow-2xl p-8 w-full border border-blue relative overflow-hidden';

const mergeClasses = (base, extra) => {
  if (!extra) return base;
  return `${base} ${extra}`.trim();
};

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
