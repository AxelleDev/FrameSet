// Badge d'etat pour la copie.
import React from 'react';

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
