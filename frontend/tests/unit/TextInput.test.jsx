import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextInput from '../../src/components/TextInput';

describe('TextInput', () => {
  it('rend un input et applique le fond teinté (sans bordure)', () => {
    render(<TextInput placeholder="Email" />);
    const input = screen.getByPlaceholderText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('bg-blue/10');
    expect(input.className).not.toMatch(/\bborder\b/);
  });

  it('transmet value/onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} placeholder="Nom" />);
    await user.type(screen.getByPlaceholderText('Nom'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('ajoute la police monospace avec `mono`', () => {
    render(<TextInput mono placeholder="#hex" />);
    expect(screen.getByPlaceholderText('#hex')).toHaveClass('font-mono');
  });

  it('rend un <select> avec ses options via as="select"', () => {
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

  it('peut être désactivé', () => {
    render(<TextInput disabled placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toBeDisabled();
  });
});
