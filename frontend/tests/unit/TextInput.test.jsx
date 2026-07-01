import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextInput from '../../src/components/TextInput';

describe('TextInput', () => {
  it('renders an input and applies the tinted background (no border)', () => {
    render(<TextInput placeholder="Email" />);
    const input = screen.getByPlaceholderText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('bg-blue/10');
    expect(input.className).not.toMatch(/\bborder\b/);
  });

  it('forwards value/onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} placeholder="Name" />);
    await user.type(screen.getByPlaceholderText('Name'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('adds the monospace font with `mono`', () => {
    render(<TextInput mono placeholder="#hex" />);
    expect(screen.getByPlaceholderText('#hex')).toHaveClass('font-mono');
  });

  it('renders a <select> with its options via as="select"', () => {
    render(
      <TextInput as="select" aria-label="type">
        <option value="a">A</option>
        <option value="b">B</option>
      </TextInput>
    );
    const select = screen.getByRole('combobox', { name: 'type' });
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<TextInput disabled placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toBeDisabled();
  });
});
