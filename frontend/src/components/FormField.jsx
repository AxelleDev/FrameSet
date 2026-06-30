// Form field with an associated label.
import React, { useId } from 'react';

/**
 * Labelled form field wrapper. Generates a stable id when none is provided and
 * wires the label's htmlFor to the input via cloneElement for accessibility.
 *
 * @param {object} props
 * @param {string} [props.label] - Optional field label text.
 * @param {React.ReactElement} props.children - The control element to label (input/select/...).
 * @param {string} [props.id] - Explicit id; auto-generated when omitted.
 * @param {string} [props.className] - Classes for the wrapping container.
 * @param {string} [props.labelClassName] - Classes for the label element.
 */
export default function FormField({
  label,
  children,
  id,
  className = '',
  labelClassName = 'block text-sm font-medium text-primary mb-2'
}) {
  // Always call useId (hooks must run unconditionally), then prefer an
  // explicit caller-provided id over the generated fallback.
  const autoId = useId();
  const generatedId = id || autoId;

  // Inject the id onto the child control (unless it already has one) so the label can target it.
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
