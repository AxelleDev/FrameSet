import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorInput from '../../src/components/ColorInput';

describe('ColorInput', () => {
  it('seeds the field from initialHex without emitting until edited', () => {
    // No mount emit: HSL/HSB round-trips are lossy, so re-deriving the seeded
    // value would drift an existing color merely by opening the modal.
    const onChange = vi.fn();
    render(<ColorInput initialHex="#dbe7e5" onChange={onChange} />);
    expect(screen.getByLabelText(/color value/i)).toHaveValue('#DBE7E5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('parses a hex the user types and reports the canonical value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorInput onChange={onChange} />);

    const field = screen.getByLabelText(/color value/i);
    await user.clear(field);
    await user.type(field, '#ff0000');
    expect(onChange).toHaveBeenLastCalledWith('#FF0000');
  });

  it('lets you switch to RGB and enter numbers, converting to hex', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorInput onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'RGB' }));
    const field = screen.getByLabelText(/color value/i);
    await user.clear(field);
    await user.type(field, '255, 0, 0');
    expect(onChange).toHaveBeenLastCalledWith('#FF0000');
  });

  it('converts the current color when switching formats', async () => {
    const user = userEvent.setup();
    render(<ColorInput initialHex="#FF0000" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'RGB' }));
    expect(screen.getByLabelText(/color value/i)).toHaveValue('255, 0, 0');
  });

  it('reports null and shows an error for an invalid value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorInput initialFormat="rgb" onChange={onChange} />);

    const field = screen.getByLabelText(/color value/i);
    await user.type(field, '300, 0, 0');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/enter a valid rgb color/i)).toBeInTheDocument();
  });
});
