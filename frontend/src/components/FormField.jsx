// Form field with an associated label.
import React, { useId } from 'react';
import PropTypes from 'prop-types';

/**
 * Labelled form field wrapper. Generates a stable id when none is provided and
 * wires the label's htmlFor to the input via cloneElement for accessibility.
 * When `error` is set, it renders the message and links it to the control via
 * aria-describedby + aria-invalid; `required` adds aria-required.
 *
 * Pass the control as the SINGLE child. Render hints/checklists outside the
 * FormField (a second child would break the label association).
 *
 * @param {object} props
 * @param {string} [props.label] - Optional field label text.
 * @param {React.ReactElement} props.children - The control element to label (input/select/...).
 * @param {string} [props.id] - Explicit id; auto-generated when omitted.
 * @param {string} [props.error] - Validation message; shown and linked when truthy.
 * @param {boolean} [props.required] - Marks the control as required (aria-required).
 * @param {string} [props.className] - Classes for the wrapping container.
 * @param {string} [props.labelClassName] - Classes for the label element.
 */
export default function FormField({
  label,
  children,
  id,
  error,
  required = false,
  className = '',
  labelClassName = 'block text-sm font-medium text-primary mb-2'
}) {
  // Always call useId (hooks must run unconditionally), then prefer an
  // explicit caller-provided id over the generated fallback.
  const autoId = useId();
  const generatedId = id || autoId;
  const errorId = `${generatedId}-error`;

  // Inject the id + ARIA state onto the child control so the label targets it,
  // errors are announced/linked, and required is exposed to assistive tech.
  const childWithProps = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || generatedId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        // Combine the error id with any describedby the control already had, so
        // linking the error message never drops an existing description.
        'aria-describedby': error
          ? [errorId, children.props['aria-describedby']].filter(Boolean).join(' ')
          : children.props['aria-describedby'],
        'aria-required': required ? true : children.props['aria-required'],
      })
    : children;

  return (
    <div className={className}>
      {label ? <label htmlFor={generatedId} className={labelClassName}>{label}</label> : null}
      {childWithProps}
      {error ? <p id={errorId} className="text-xs text-danger mt-1">{error}</p> : null}
    </div>
  );
}

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node,
  id: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
};
