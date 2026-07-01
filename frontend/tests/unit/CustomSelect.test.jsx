import React from 'react';
import { render, screen } from '@testing-library/react';
import CustomSelect from '../../src/components/CustomSelect';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'brush', label: 'Brush' },
  { value: 'typography', label: 'Typography' },
];

describe('CustomSelect', () => {
  it('shows the label of the selected value', () => {
    render(<CustomSelect value="brush" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByText('Brush')).toBeInTheDocument();
  });

  it('shows the placeholder when there is no value', () => {
    render(<CustomSelect value="" onChange={() => {}} options={OPTIONS} placeholder="Filter…" />);
    expect(screen.getByText('Filter…')).toBeInTheDocument();
  });

  it('accepts options given as strings', () => {
    render(<CustomSelect value="Inter" onChange={() => {}} options={['Inter', 'Roboto']} />);
    expect(screen.getByText('Inter')).toBeInTheDocument();
  });
});
