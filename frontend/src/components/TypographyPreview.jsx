import React from 'react';
import PropTypes from 'prop-types';

/** The typography preview strip content: an "AaBbCc" specimen rendered in the
    real font once it has loaded, else a "Loading…" placeholder — the exact
    same rendering used by ProjectNorms, the Shared reference sheet and
    Landing's mockup (via StandardCard). */
export default function TypographyPreview({ fontFamily, fontStyle, loaded }) {
  if (!loaded) {
    return (
      <span className="text-xs text-secondary">
        Loading… <span style={{ fontFamily: `'${fontFamily}', Arial, sans-serif` }}>{fontFamily}</span>
      </span>
    );
  }

  return (
    <span
      className="text-primary text-xl font-medium tracking-tight"
      style={{ fontFamily: `'${fontFamily}', Arial, sans-serif`, fontStyle: fontStyle ? fontStyle.toLowerCase() : undefined }}
      title={fontFamily}
    >
      AaBbCc
    </span>
  );
}

TypographyPreview.propTypes = {
  fontFamily: PropTypes.string,
  fontStyle: PropTypes.string,
  loaded: PropTypes.bool,
};
