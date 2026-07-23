import React, { useId } from 'react';
import PropTypes from 'prop-types';

/**
 * Labelled form field wrapper: clones the SINGLE child control to wire label,
 * error linking (aria-describedby/aria-invalid) and aria-required onto it.
 * Pass the control as the only child; render hints/checklists outside so a
 * second child can't break the label association.
 */
export default function FormField({
  label,
  children,
  id,
  error,
  required = false,
  className = '',
  labelClassName = 'block text-sm font-medium text-primary mb-2',
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
      {label ? (
        <label htmlFor={generatedId} className={labelClassName}>
          {label}
        </label>
      ) : null}
      {childWithProps}
      {error ? (
        <p id={errorId} className="text-xs text-danger mt-1">
          {error}
        </p>
      ) : null}
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
