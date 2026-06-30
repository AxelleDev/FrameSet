import React from 'react';
import { render, screen } from '@testing-library/react';
import Alert from '../../src/components/Alert';

describe('Alert', () => {
  it('rend son contenu', () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('utilise le role "alert" pour une erreur', () => {
    render(<Alert variant="error">Oups</Alert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Oups');
    expect(el).toHaveClass('bg-danger/10');
  });

  it('utilise le role "status" pour info/success', () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole('status')).toHaveClass('bg-blue/10');

    rerender(<Alert variant="success">OK</Alert>);
    expect(screen.getByRole('status')).toHaveClass('bg-success/10');
  });
});
