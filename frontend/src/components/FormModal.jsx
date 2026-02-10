// Modale de formulaire avec decoration et titre.
import React from 'react';
import AppModal from './AppModal';

export default function FormModal({
  isOpen,
  onClose,
  title,
  children,
  panelClassName = 'max-w-sm',
  showClose = false,
  bodyClassName = '',
  decorationClassName = 'absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full -mr-16 -mt-16 opacity-50',
  titleClassName = 'text-xl font-light text-primary mb-6'
}) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      showClose={showClose}
      panelClassName={panelClassName}
    >
      <div className={decorationClassName}></div>
      {title ? (
        <h3 className={`${titleClassName} relative z-10`.trim()}>{title}</h3>
      ) : null}
      <div className={`relative z-10 ${bodyClassName}`.trim()}>{children}</div>
    </AppModal>
  );
}
