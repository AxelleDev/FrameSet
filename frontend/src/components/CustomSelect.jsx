import React from 'react';
import PropTypes from 'prop-types';
import Select, { components as selectComponents } from 'react-select';

// Cap on option rows painted at once: react-select renders every match into the DOM, which is
// janky for the ~1,900-family Google Fonts list. Capped rows stay reachable via the search box.
const MAX_RENDERED_OPTIONS = 100;

// MenuList capped at MAX_RENDERED_OPTIONS rows; the hint only appears once the cap is exceeded.
function CappedMenuList(props) {
  const children = React.Children.toArray(props.children);
  if (children.length <= MAX_RENDERED_OPTIONS) {
    return <selectComponents.MenuList {...props}>{props.children}</selectComponents.MenuList>;
  }
  const hiddenCount = children.length - MAX_RENDERED_OPTIONS;
  return (
    <selectComponents.MenuList {...props}>
      {children.slice(0, MAX_RENDERED_OPTIONS)}
      <div className="px-3 py-2 text-xs text-secondary" aria-hidden="true">
        {hiddenCount} more — type to narrow your search.
      </div>
    </selectComponents.MenuList>
  );
}

CappedMenuList.propTypes = { children: PropTypes.node };

// Themed wrapper around react-select matching the app's TextInput. Accepts plain string or
// `{ value, label }` options and exposes a controlled string `value`/`onChange` API ('' when cleared).
export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  isClearable = false,
  components,
  id,
  inputId,
  ...props
}) {
  // Normalize string options into the { value, label } shape react-select expects.
  const selectOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );
  // Derive the selected option object from the controlled string value.
  const selected = selectOptions.find((opt) => opt.value === value) || null;

  return (
    <Select
      options={selectOptions}
      value={selected}
      onChange={(opt) => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isClearable={isClearable}
      // react-select puts `id` on the outer container (not labelable) but
      // `inputId` on the actual search input — a <label htmlFor> (e.g. from
      // FormField, which only knows to pass `id`) needs the latter to
      // actually associate. Falling back to `id` here means every existing
      // "<FormField><CustomSelect /></FormField>" pairing gets a correctly
      // labelled, accessible input for free, with no per-call-site wiring.
      inputId={inputId || id}
      menuPlacement="auto"
      // Body-level fixed portal so the menu escapes the page shell's overflow/stacking
      // contexts; without it the menu is trapped beneath the cards grid below.
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      components={{ MenuList: CappedMenuList, ...components }}
      styles={{
        control: (provided, state) => ({
          ...provided,
          backgroundColor: state.isFocused
            ? 'rgb(var(--color-surface))'
            : 'rgb(var(--color-blue) / 0.1)',
          border: 'none',
          borderRadius: '0.75rem',
          minHeight: '3rem',
          fontSize: '1rem', // ≥16px so iOS Safari doesn't zoom the viewport on focus
          boxShadow: state.isFocused ? '0 0 0 2px rgb(var(--color-blue) / 0.5)' : 'none',
          transition: 'all 0.15s ease',
        }),
        valueContainer: (provided) => ({ ...provided, padding: '0.15rem 0.75rem' }),
        placeholder: (provided) => ({ ...provided, color: 'rgb(var(--color-secondary))' }),
        singleValue: (provided) => ({
          ...provided,
          color: 'rgb(var(--color-primary))',
          fontWeight: 500,
        }),
        input: (provided) => ({
          ...provided,
          color: 'rgb(var(--color-primary))',
          fontSize: '1rem',
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (provided, state) => ({
          ...provided,
          color: 'rgb(var(--color-blue))',
          transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s ease',
        }),
        clearIndicator: (provided) => ({ ...provided, color: 'rgb(var(--color-secondary))' }),
        menu: (provided) => ({
          ...provided,
          backgroundColor: 'rgb(var(--color-surface))',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: 'none',
          border: '1px solid rgb(var(--color-primary) / 0.1)',
          zIndex: 1000, // matches the `dropdown` tier of the z-index scale (tailwind.config.js)
          marginTop: '0.4rem',
        }),
        // `popover` tier (tailwind.config.js): above the modal tier (1050) so the
        // menu shows when the select is inside a FormModal (e.g. the font picker),
        // but below the toast tier (1060) so an open menu never hides a toast.
        menuPortal: (provided) => ({ ...provided, zIndex: 1055 }),
        menuList: (provided) => ({
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
          padding: '0.75rem', // ~44px row height for comfortable touch targets
          fontSize: '1rem',
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

CustomSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ value: PropTypes.string, label: PropTypes.string }),
    ]),
  ),
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  isClearable: PropTypes.bool,
  components: PropTypes.object,
};
