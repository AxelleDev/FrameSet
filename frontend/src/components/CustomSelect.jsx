import React from 'react';
import PropTypes from 'prop-types';
import Select, { components as selectComponents } from 'react-select';

// Cap on how many option rows are painted into the menu at once. react-select
// renders every matching option into the DOM, which is fine for short lists but
// janky for the ~1,900-family Google Fonts list. We render only the first slice
// and invite the user to type to narrow — the remaining options stay reachable
// through the search box (react-select filters the children we receive here).
const MAX_RENDERED_OPTIONS = 100;

/**
 * MenuList that renders at most MAX_RENDERED_OPTIONS rows, keeping the DOM light
 * for very large option sets. For small lists it behaves exactly like the
 * default MenuList (the extra hint only appears once the cap is exceeded).
 */
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

/**
 * Themed wrapper around react-select, styled to match the app's TextInput
 * (soft blue fill, periwinkle border, blue focus ring, rounded menu with
 * pill-like options). Accepts plain string options or `{ value, label }`
 * objects and exposes a controlled string `value`/`onChange` API. Very large
 * option lists (e.g. the font picker) are render-capped for performance.
 *
 * @param {object} props
 * @param {Array<string|{value:string,label:string}>} props.options - Available options.
 * @param {string} props.value - Currently selected value (controlled).
 * @param {Function} props.onChange - Called with the selected value (or '' when cleared).
 * @param {string} [props.placeholder] - Placeholder text.
 * @param {boolean} [props.isClearable] - Whether a clear (×) control is shown (default false).
 * @param {object} [props.components] - Extra react-select component overrides (merged in).
 */
export default function CustomSelect({ options, value, onChange, placeholder, isClearable = false, components, ...props }) {
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
      // Render the menu in a body-level portal (with fixed positioning) so it
      // escapes the scrolling/overflow + stacking contexts of the page shell
      // (the `overflow-auto relative` <main> and its `sticky` header). Without
      // this the menu is trapped beneath the cards grid below it.
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      components={{ MenuList: CappedMenuList, ...components }}
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
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: 'none',
          border: '1px solid rgb(var(--color-primary) / 0.1)',
          zIndex: 1000, // matches the `dropdown` tier of the z-index scale (tailwind.config.js)
          marginTop: '0.4rem',
        }),
        // The portal wrapper sits above the modal tier (1050) so the menu still
        // shows when the select is used inside a FormModal (e.g. the font picker).
        menuPortal: provided => ({ ...provided, zIndex: 1100 }),
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

CustomSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ value: PropTypes.string, label: PropTypes.string }),
    ])
  ),
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  isClearable: PropTypes.bool,
  components: PropTypes.object,
};
