import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar from '../../src/components/Avatar';

describe('Avatar', () => {
  it('affiche les initiales', () => {
    render(<Avatar initials="PN" />);
    expect(screen.getByText('PN')).toBeInTheDocument();
  });

  it('applique le fond teinté et les classes de taille passées', () => {
    render(<Avatar initials="PN" className="w-28 h-28 text-4xl" />);
    const el = screen.getByText('PN');
    expect(el).toHaveClass('bg-blue/15', 'text-blue', 'w-28', 'h-28', 'text-4xl');
  });
});
