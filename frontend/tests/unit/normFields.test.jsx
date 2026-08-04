// The two standards form-field groups (shared by the add AND edit modals):
// every field wires to setField, and validation hints appear exactly when a
// non-empty value is invalid.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrushNormFields from '../../src/components/BrushNormFields';
import TypographyNormFields from '../../src/components/TypographyNormFields';

vi.mock('../../src/hooks/useGoogleFonts', () => ({
  default: () => ({ fonts: [{ family: 'Figtree', variants: ['400', '700'] }], loading: false }),
}));

describe('BrushNormFields', () => {
  const baseForm = { usage: '', name: '', value: '', unit: 'px', opacity: '' };

  it('wires every field to setField with its key', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<BrushNormFields form={baseForm} setField={setField} isValueValid />);

    await user.type(screen.getByLabelText(/usage/i), 'L');
    expect(setField).toHaveBeenCalledWith('usage', 'L');

    await user.type(screen.getByLabelText(/size/i), '8');
    expect(setField).toHaveBeenCalledWith('value', '8');
  });

  it('shows the size validation hint only for a non-empty invalid value', () => {
    const { rerender } = render(
      <BrushNormFields form={baseForm} setField={vi.fn()} isValueValid={false} />,
    );
    // Empty value: no error yet.
    expect(screen.queryByText(/positive number/i)).not.toBeInTheDocument();

    rerender(
      <BrushNormFields
        form={{ ...baseForm, value: '-3' }}
        setField={vi.fn()}
        isValueValid={false}
      />,
    );
    expect(screen.getByText(/positive number/i)).toBeInTheDocument();
  });
});

describe('TypographyNormFields', () => {
  const baseForm = { fontUsage: '', fontFamily: '', fontWeight: '400', fontStyle: '' };

  it('renders the usage field wired to setField', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    render(<TypographyNormFields form={baseForm} setField={setField} />);

    await user.type(screen.getByLabelText(/usage/i), 'T');
    expect(setField).toHaveBeenCalledWith('fontUsage', 'T');
  });
});
