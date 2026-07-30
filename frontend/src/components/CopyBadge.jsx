// Status badge for copy-to-clipboard actions.
import React from 'react';
import PropTypes from 'prop-types';

// Small pill that reflects clipboard copy state, swapping its label once copied.
export default function CopyBadge({ isCopied, copiedLabel = 'Copied!', defaultLabel = 'Copy' }) {
  return (
    <span className="px-3 py-1 bg-surface/90 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary transform scale-90 group-hover:scale-100 group-data-[revealed]:scale-100 transition-transform">
      {isCopied ? copiedLabel : defaultLabel}
    </span>
  );
}

CopyBadge.propTypes = {
  isCopied: PropTypes.bool,
  copiedLabel: PropTypes.string,
  defaultLabel: PropTypes.string,
};
