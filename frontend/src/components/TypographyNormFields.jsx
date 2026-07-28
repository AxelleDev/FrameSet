import React from 'react';
import PropTypes from 'prop-types';
import FormField from './FormField';
import TextInput from './TextInput';
import CustomSelect from './CustomSelect';
import { loadGoogleFont } from '../utils/loadGoogleFont';

// The typography-standard form fields, shared verbatim by ProjectNorms' "New
// standard" and "Edit standard" modals so the two can never drift apart.
// Picking a font also starts loading it, so its live preview is ready by the
// time the standard is saved.
export default function TypographyNormFields({ form, setField, googleFonts, loading, error }) {
  return (
    <>
      <FormField label="Font">
        <CustomSelect
          value={form.fontFamily}
          onChange={(val) => {
            setField('fontFamily', val);
            const selectedFont = googleFonts?.find((f) => f.family === val);
            if (selectedFont) {
              loadGoogleFont(
                selectedFont.family,
                selectedFont.variants?.includes('regular')
                  ? '400'
                  : selectedFont.variants?.[0] || '400',
              );
            }
          }}
          options={
            googleFonts
              ? googleFonts.map((font) => ({ value: font.family, label: font.family }))
              : []
          }
          placeholder="Search fonts…"
          isLoading={loading}
          isDisabled={loading}
          noOptionsMessage={() => (loading ? 'Loading…' : 'No matching fonts')}
        />
      </FormField>
      {loading && <div className="text-xs text-secondary mt-1">Loading fonts…</div>}
      {error && <div className="text-xs text-danger mt-1">Error loading fonts</div>}
      <FormField label="Weight">
        <TextInput
          type="text"
          value={form.fontWeight}
          onChange={(e) => setField('fontWeight', e.target.value)}
          placeholder="700"
        />
      </FormField>
      <FormField label="Usage">
        <TextInput
          type="text"
          value={form.fontUsage}
          onChange={(e) => setField('fontUsage', e.target.value)}
          placeholder="Title"
        />
      </FormField>
      <FormField label="Style">
        <TextInput
          type="text"
          value={form.fontStyle}
          onChange={(e) => setField('fontStyle', e.target.value)}
          placeholder="Italic"
        />
      </FormField>
    </>
  );
}

TypographyNormFields.propTypes = {
  form: PropTypes.shape({
    fontFamily: PropTypes.string,
    fontWeight: PropTypes.string,
    fontUsage: PropTypes.string,
    fontStyle: PropTypes.string,
  }).isRequired,
  setField: PropTypes.func.isRequired,
  googleFonts: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.object, PropTypes.string]),
};
