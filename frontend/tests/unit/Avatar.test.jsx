import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar from '../../src/components/Avatar';

describe('Avatar', () => {
  it('shows the initials', () => {
    render(<Avatar initials="JD" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies the tinted background and the size classes passed in', () => {
    render(<Avatar initials="JD" className="w-28 h-28 text-4xl" />);
    const el = screen.getByText('JD');
    expect(el).toHaveClass('bg-blue/15', 'text-blue', 'w-28', 'h-28', 'text-4xl');
  });
});
