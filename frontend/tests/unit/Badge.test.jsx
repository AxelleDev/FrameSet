import React from 'react';
import { render, screen } from '@testing-library/react';
import Badge from '../../src/components/Badge';

describe('Badge', () => {
  it('rend son label', () => {
    render(<Badge>Trait</Badge>);
    expect(screen.getByText('Trait')).toBeInTheDocument();
  });

  it.each([
    ['primary', 'bg-primary/10'],
    ['blue', 'bg-blue/10'],
    ['danger', 'bg-danger/10'],
  ])('applique la couleur %s (rempli, sans bordure)', (color, expectedClass) => {
    render(<Badge color={color}>X</Badge>);
    const el = screen.getByText('X');
    expect(el).toHaveClass(expectedClass);
    expect(el.className).not.toMatch(/\bborder\b/);
  });

  it('retombe sur primary pour une couleur inconnue', () => {
    render(<Badge color="unknown">X</Badge>);
    expect(screen.getByText('X')).toHaveClass('bg-primary/10');
  });
});
