// Status badge for copy-to-clipboard actions.
import React from 'react';

/**
 * Small pill that reflects clipboard copy state, swapping its label once copied.
 *
 * @param {object} props
 * @param {boolean} props.isCopied - Whether the value was just copied.
 * @param {string} [props.copiedLabel] - Label shown after copying.
 * @param {string} [props.defaultLabel] - Default label before copying.
 */
export default function CopyBadge({
  isCopied,
  copiedLabel = 'Copié !',
  defaultLabel = 'Copier'
}) {
  return (
    <span className="px-3 py-1 bg-white/90 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm transform scale-90 group-hover:scale-100 transition-transform">
      {isCopied ? copiedLabel : defaultLabel}
    </span>
  );
}
