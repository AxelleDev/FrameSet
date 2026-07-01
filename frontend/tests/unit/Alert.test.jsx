import React from 'react';
import { render, screen } from '@testing-library/react';
import Alert from '../../src/components/Alert';

describe('Alert', () => {
  it('renders its content', () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('uses the "alert" role for an error', () => {
    render(<Alert variant="danger">Oops</Alert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Oops');
    expect(el).toHaveClass('bg-danger/10');
  });

  it('uses the "status" role for info/success', () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole('status')).toHaveClass('bg-blue/10');

    rerender(<Alert variant="success">OK</Alert>);
    expect(screen.getByRole('status')).toHaveClass('bg-success/10');
  });
});
