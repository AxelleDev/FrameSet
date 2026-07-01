import React from 'react';
import { render, screen } from '@testing-library/react';
import Badge from '../../src/components/Badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>Stroke</Badge>);
    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });

  it.each([
    ['primary', 'bg-primary/10'],
    ['blue', 'bg-blue/10'],
    ['danger', 'bg-danger/10'],
  ])('applies the %s color (filled, no border)', (color, expectedClass) => {
    render(<Badge color={color}>X</Badge>);
    const el = screen.getByText('X');
    expect(el).toHaveClass(expectedClass);
    expect(el.className).not.toMatch(/\bborder\b/);
  });

  it('falls back to primary for an unknown color', () => {
    render(<Badge color="unknown">X</Badge>);
    expect(screen.getByText('X')).toHaveClass('bg-primary/10');
  });
});
