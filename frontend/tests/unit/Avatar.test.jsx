import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar from '../../src/components/Avatar';

describe('Avatar', () => {
  it('affiche les initiales', () => {
    render(<Avatar initials="AT" />);
    expect(screen.getByText('AT')).toBeInTheDocument();
  });

  it('applique le fond teinté et les classes de taille passées', () => {
    render(<Avatar initials="AT" className="w-28 h-28 text-4xl" />);
    const el = screen.getByText('AT');
    expect(el).toHaveClass('bg-blue/10', 'text-blue', 'w-28', 'h-28', 'text-4xl');
  });
});
