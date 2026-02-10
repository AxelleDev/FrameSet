// Tuile d'ajout pour creer un element.
import React from 'react';

export default function AddTile({
  onClick,
  label = 'Ajouter',
  className = '',
  labelClassName = 'text-xs font-bold uppercase tracking-widest text-primary'
}) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-2xl border-2 border-dashed [border-color:var(--color-secondary)] flex flex-col items-center justify-center cursor-pointer hover:![border-color:var(--color-blue)] hover:bg-pink/10 transition-all ${className}`.trim()}
    >
      <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center [color:var(--color-secondary)] group-hover:[color:var(--color-blue)] group-hover:bg-blue/10 transition-colors mb-3 transition-transform group-hover:scale-110">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
