// Champ de formulaire avec label.
import React from 'react';

export default function FormField({
  label,
  children,
  className = '',
  labelClassName = 'block text-xs font-bold text-primary uppercase tracking-widest mb-2'
}) {
  return (
    <div className={className}>
      {label ? <label className={labelClassName}>{label}</label> : null}
      {children}
    </div>
  );
}
