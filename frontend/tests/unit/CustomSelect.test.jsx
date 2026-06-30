import React from 'react';
import { render, screen } from '@testing-library/react';
import CustomSelect from '../../src/components/CustomSelect';

const OPTIONS = [
  { value: 'all', label: 'Tout' },
  { value: 'brush', label: 'Trait' },
  { value: 'typography', label: 'Typographie' },
];

describe('CustomSelect', () => {
  it('affiche le label de la valeur sélectionnée', () => {
    render(<CustomSelect value="brush" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByText('Trait')).toBeInTheDocument();
  });

  it('affiche le placeholder quand aucune valeur', () => {
    render(<CustomSelect value="" onChange={() => {}} options={OPTIONS} placeholder="Filtrer…" />);
    expect(screen.getByText('Filtrer…')).toBeInTheDocument();
  });

  it('accepte des options sous forme de chaînes', () => {
    render(<CustomSelect value="Inter" onChange={() => {}} options={['Inter', 'Roboto']} />);
    expect(screen.getByText('Inter')).toBeInTheDocument();
  });
});
