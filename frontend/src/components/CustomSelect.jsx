import React from 'react';
import Select from 'react-select';

/**
 * Themed wrapper around react-select, styled to match the app's TextInput
 * (soft blue fill, periwinkle border, blue focus ring, rounded menu with
 * pill-like options). Accepts plain string options or `{ value, label }`
 * objects and exposes a controlled string `value`/`onChange` API.
 *
 * @param {object} props
 * @param {Array<string|{value:string,label:string}>} props.options - Available options.
 * @param {string} props.value - Currently selected value (controlled).
 * @param {Function} props.onChange - Called with the selected value (or '' when cleared).
 * @param {string} [props.placeholder] - Placeholder text.
 * @param {boolean} [props.isClearable] - Whether a clear (×) control is shown (default false).
 */
export default function CustomSelect({ options, value, onChange, placeholder, isClearable = false, ...props }) {
  // Normalize string options into the { value, label } shape react-select expects.
  const selectOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
  // Derive the selected option object from the controlled string value.
  const selected = selectOptions.find(opt => opt.value === value) || null;

  return (
    <Select
      options={selectOptions}
      value={selected}
      onChange={opt => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isClearable={isClearable}
      menuPlacement="auto"
      styles={{
        control: (provided, state) => ({
          ...provided,
          backgroundColor: state.isFocused ? 'rgb(var(--color-surface))' : 'rgb(var(--color-blue) / 0.1)',
          border: 'none',
          borderRadius: '0.75rem',
          minHeight: '3rem',
          boxShadow: state.isFocused ? '0 0 0 2px rgb(var(--color-blue) / 0.5)' : 'none',
          transition: 'all 0.15s ease',
        }),
        valueContainer: provided => ({ ...provided, padding: '0.15rem 0.75rem' }),
        placeholder: provided => ({ ...provided, color: 'rgb(var(--color-secondary))' }),
        singleValue: provided => ({ ...provided, color: 'rgb(var(--color-primary))', fontWeight: 500 }),
        input: provided => ({ ...provided, color: 'rgb(var(--color-primary))' }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (provided, state) => ({
          ...provided,
          color: 'rgb(var(--color-blue))',
          transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s ease',
        }),
        clearIndicator: provided => ({ ...provided, color: 'rgb(var(--color-secondary))' }),
        menu: provided => ({
          ...provided,
          backgroundColor: 'rgb(var(--color-surface))',
          borderRadius: '1rem',
          overflow: 'hidden',
          zIndex: 50,
        }),
        menuList: provided => ({
          ...provided,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: '0.25rem',
          maxHeight: 288,
        }),
        option: (provided, state) => ({
          ...provided,
          borderRadius: '0.6rem',
          padding: '0.6rem 0.75rem',
          backgroundColor: state.isSelected
            ? 'rgb(var(--color-blue))'
            : state.isFocused
              ? 'rgb(var(--color-blue) / 0.15)'
              : 'transparent',
          color: state.isSelected ? '#ffffff' : 'rgb(var(--color-primary))',
          fontWeight: state.isSelected ? 600 : 400,
          cursor: 'pointer',
        }),
      }}
      {...props}
    />
  );
}
