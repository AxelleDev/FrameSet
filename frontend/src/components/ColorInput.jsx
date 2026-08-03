import React, { useId, useState } from 'react';
import PropTypes from 'prop-types';
import ColorFormatToggle from './ColorFormatToggle';
import TextInput from './TextInput';
import { EyedropperIcon } from './icons';
import { formatColor, isColorFormat } from '../utils/colorFormats';
import { parseColorInput } from '../utils/colorParse';
import { normalizeHexInput, handleHexKeyDown } from '../utils/hex';

/**
 * Enter a color in the format of your choice (HEX / RGB / HSL / HSB). Bundles a
 * format toggle, the native color picker and a text field, and normalizes
 * whatever you type into a canonical `#RRGGBB` hex — the one form the app
 * stores. `onChange` receives that hex, or null while the field isn't a valid
 * color of the selected format (so the caller can block saving).
 *
 * Uncontrolled by design: it seeds its state from `initialHex`/`initialFormat`
 * once (the add/edit modals remount it each time they open), then owns the
 * editing buffer so partial input never fights the user.
 */

// Placeholder examples per format.
const PLACEHOLDERS = {
  hex: '#FF5500',
  rgb: '255, 85, 0',
  hsl: '20, 100%, 50%',
  hsb: '20, 100%, 100%',
};

// The editable text for a hex color in a given format: the bare, easy-to-edit
// numbers for RGB/HSL/HSB (the wrapper is dropped), the "#RRGGBB" for hex.
const hexToFieldText = (hex, format) => {
  if (format === 'hex') return normalizeHexInput(hex || '#');
  if (!hex) return '';
  return formatColor(hex, format)
    .replace(/^[a-z]+\(/i, '')
    .replace(/\)$/, '');
};

export default function ColorInput({
  initialHex = '',
  initialFormat = 'hex',
  onChange,
  label = 'Color value',
}) {
  const startFormat = isColorFormat(initialFormat) ? initialFormat : 'hex';
  const [format, setFormat] = useState(startFormat);
  const [text, setText] = useState(() => hexToFieldText(initialHex, startFormat));
  const fieldId = useId();

  // Reports the parsed hex (or null) to the parent for the given text+format.
  const emit = (nextText, nextFormat) => {
    onChange?.(parseColorInput(nextText, nextFormat));
  };

  // Deliberately NOT emitting on mount: the parent seeds the value itself (the
  // edit modal from the color's own hex, the add modal as empty). Emitting the
  // seeded value would re-derive it through the current format — and since HSL/
  // HSB round-trips are lossy, merely opening the edit modal in one of those
  // formats would drift a color by a shade. So the original is preserved until
  // the user actually edits the field.

  const handleTextChange = (event) => {
    // Keep the hex field's leading '#' and character filtering behavior.
    const value = format === 'hex' ? normalizeHexInput(event.target.value) : event.target.value;
    setText(value);
    emit(value, format);
  };

  // Switching format converts the current (valid) color into the new format's
  // text so the value carries over; an invalid field just resets to empty.
  const handleFormatChange = (nextFormat) => {
    const currentHex = parseColorInput(text, format);
    const nextText = hexToFieldText(currentHex || '', nextFormat);
    setFormat(nextFormat);
    setText(nextText);
    emit(nextText, nextFormat);
  };

  // The native picker always yields hex; mirror it into the current format.
  const handlePicker = (event) => {
    const nextText = hexToFieldText(event.target.value.toUpperCase(), format);
    setText(nextText);
    emit(nextText, format);
  };

  // Screen eyedropper (Chromium only — the button hides itself elsewhere):
  // the OS-level picker samples ANY pixel on screen, other windows included.
  const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const handleEyeDropper = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const nextText = hexToFieldText(sRGBHex.toUpperCase(), format);
      setText(nextText);
      emit(nextText, format);
    } catch {
      /* the user pressed Esc — nothing to do */
    }
  };

  const parsedHex = parseColorInput(text, format);
  const trimmed = text.trim();
  const showError = trimmed !== '' && trimmed !== '#' && !parsedHex;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-primary">
          {label}
        </label>
        <ColorFormatToggle
          value={format}
          onChange={handleFormatChange}
          ariaLabel="Color input format"
        />
      </div>
      <div className="flex gap-3">
        <input
          type="color"
          value={(parsedHex || '#ffffff').toLowerCase()}
          onChange={handlePicker}
          aria-label="Pick a color"
          className="h-12 w-12 flex-shrink-0 cursor-pointer rounded-xl border border-blue/30 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 focus-ring"
        />
        {supportsEyeDropper && (
          <button
            type="button"
            onClick={handleEyeDropper}
            aria-label="Pick a color from the screen"
            title="Pick a color from the screen"
            className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-blue/30 text-primary hover:bg-blue/10 transition-colors focus-ring"
          >
            <EyedropperIcon className="w-5 h-5" />
          </button>
        )}
        <TextInput
          id={fieldId}
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={format === 'hex' ? handleHexKeyDown : undefined}
          placeholder={PLACEHOLDERS[format]}
          aria-invalid={showError}
          aria-describedby={showError ? `${fieldId}-error` : undefined}
          mono
          className="flex-1"
        />
      </div>
      {showError && (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-danger">
          Enter a valid {format.toUpperCase()} color.
        </p>
      )}
    </div>
  );
}

ColorInput.propTypes = {
  // Seed value (canonical hex like '#DBE7E5', or '' for a blank field).
  initialHex: PropTypes.string,
  // Seed input format; defaults to hex.
  initialFormat: PropTypes.string,
  // Receives the parsed '#RRGGBB' hex, or null while the field isn't valid.
  onChange: PropTypes.func,
  label: PropTypes.string,
};
