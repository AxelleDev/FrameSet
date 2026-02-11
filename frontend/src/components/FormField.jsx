// Champ de formulaire avec label.
import React, { useId } from 'react';

export default function FormField({
  label,
  children,
  id,
  className = '',
  labelClassName = 'block text-xs font-bold text-primary uppercase tracking-widest mb-2'
}) {
  const generatedId = id || useId();

  const childWithId = React.isValidElement(children)
    ? React.cloneElement(children, { id: children.props.id || generatedId })
    : children;

  return (
    <div className={className}>
      {label ? <label htmlFor={generatedId} className={labelClassName}>{label}</label> : null}
      {childWithId}
    </div>
  );
}
