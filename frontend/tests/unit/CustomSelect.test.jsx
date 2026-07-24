import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomSelect from '../../src/components/CustomSelect';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'brush', label: 'Brush' },
  { value: 'typography', label: 'Typography' },
];

const FONT_OPTIONS = ['Roboto', 'Roboto Slab', 'Open Sans', 'Lobster'];

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

  it('is searchable by default: typing narrows a long list (e.g. Google Fonts) to matches', async () => {
    const user = userEvent.setup();
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={FONT_OPTIONS}
        placeholder="Search fonts…"
      />,
    );

    const input = screen.getByRole('combobox');
    await user.click(input);
    // All options open when nothing is typed yet.
    expect(screen.getByText('Lobster')).toBeInTheDocument();

    await user.type(input, 'rob');

    expect(screen.getByText('Roboto')).toBeInTheDocument();
    expect(screen.getByText('Roboto Slab')).toBeInTheDocument();
    expect(screen.queryByText('Open Sans')).not.toBeInTheDocument();
    expect(screen.queryByText('Lobster')).not.toBeInTheDocument();
  });

  it('respects isSearchable={false} (used for short fixed lists like the type filter)', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={() => {}} options={OPTIONS} isSearchable={false} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'zzz-no-match');

    // Typing has no filtering effect: every option is still shown.
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Brush')).toBeInTheDocument();
    expect(screen.getByText('Typography')).toBeInTheDocument();
  });
});
