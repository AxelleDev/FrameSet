import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Card from '../../src/components/Card';

describe('Card', () => {
  it('rend son contenu dans une surface arrondie', () => {
    render(<Card>Contenu</Card>);
    const el = screen.getByText('Contenu');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('rounded-3xl');
  });

  it('appelle onClick quand cliquable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card clickable onClick={onClick}>Carte</Card>);
    await user.click(screen.getByText('Carte'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
