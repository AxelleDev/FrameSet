import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorFormatToggle from '../../src/components/ColorFormatToggle';

describe('ColorFormatToggle', () => {
  it('renders the four formats and marks the active one', () => {
    render(<ColorFormatToggle value="rgb" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: /color display format/i });
    expect(group).toBeInTheDocument();
    ['HEX', 'RGB', 'HSL', 'HSB'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'RGB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'HEX' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the picked format id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorFormatToggle value="hex" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'HSL' }));
    expect(onChange).toHaveBeenCalledWith('hsl');
  });
});
