import React from 'react';
import PropTypes from 'prop-types';
import FormField from './FormField';
import TextInput from './TextInput';

// The brush-standard form fields, shared verbatim by ProjectNorms' "New
// standard" and "Edit standard" modals so the two can never drift apart.
export default function BrushNormFields({ form, setField, isValueValid }) {
  return (
    <>
      <FormField label="Brush usage">
        <TextInput
          type="text"
          value={form.usage}
          onChange={(e) => setField('usage', e.target.value)}
          placeholder="Hair outline"
        />
      </FormField>
      <FormField label="Brush name">
        <TextInput
          type="text"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Plume G"
        />
      </FormField>
      <FormField
        label="Size (px)"
        error={
          form.value !== '' && !isValueValid
            ? 'Size must be a positive number (≤ 1000).'
            : undefined
        }
      >
        <TextInput
          type="number"
          min="0"
          step="0.1"
          value={form.value}
          onChange={(e) => setField('value', e.target.value)}
          placeholder="8"
        />
      </FormField>
      <FormField label="Unit">
        <TextInput
          type="text"
          value={form.unit}
          onChange={(e) => setField('unit', e.target.value)}
          placeholder="px"
        />
      </FormField>
      <FormField label="Opacity (0 to 1)">
        <TextInput
          type="number"
          step="0.01"
          min={0}
          max={1}
          value={form.opacity}
          onChange={(e) => setField('opacity', e.target.value)}
          placeholder="1.0"
        />
      </FormField>
    </>
  );
}

BrushNormFields.propTypes = {
  form: PropTypes.shape({
    usage: PropTypes.string,
    name: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    unit: PropTypes.string,
    opacity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  setField: PropTypes.func.isRequired,
  isValueValid: PropTypes.bool,
};
