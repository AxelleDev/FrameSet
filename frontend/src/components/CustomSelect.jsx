import React from 'react';
import Select from 'react-select';

export default function CustomSelect({ options, value, onChange, placeholder, ...props }) {
  const selectOptions = options.map(opt =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : opt
  );
  const selected = selectOptions.find(opt => opt.value === value) || null;

  return (
    <Select
      options={selectOptions}
      value={selected}
      onChange={opt => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isClearable
      styles={{
        menu: provided => ({
          ...provided,
          zIndex: 50,
          maxHeight: 288, // 18rem
          overflowY: 'auto',
          marginBottom: 0,
        }),
        menuList: provided => ({
          ...provided,
          maxHeight: 288,
          paddingBottom: 0,
        }),
        control: provided => ({
          ...provided,
          borderRadius: '0.75rem',
          borderColor: 'var(--color-blue)',
          minHeight: '2.5rem',
          boxShadow: 'none',
        }),
        option: (provided, state) => ({
          ...provided,
          backgroundColor: state.isSelected
            ? 'var(--color-blue)'
            : state.isFocused
              ? 'rgba(137,148,223,0.15)'
              : 'white',
          color: state.isSelected ? 'white' : 'var(--color-primary)',
          fontWeight: state.isSelected ? 600 : 400,
          cursor: 'pointer',
        }),
        singleValue: provided => ({
          ...provided,
          color: 'var(--color-primary)',
        }),
        dropdownIndicator: provided => ({
          ...provided,
          color: 'var(--color-blue)',
        }),
        clearIndicator: provided => ({
          ...provided,
          color: 'var(--color-blue)',
        }),
      }}
      {...props}
    />
  );
}
