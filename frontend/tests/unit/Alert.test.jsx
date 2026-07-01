import React from 'react';
import { render, screen } from '@testing-library/react';
import Alert from '../../src/components/Alert';

describe('Alert', () => {
  it('renders its content as plain text', () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('uses the "alert" role and danger color for an error', () => {
    render(<Alert variant="danger">Oops</Alert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Oops');
    expect(el).toHaveClass('text-danger');
  });

  it('uses the "status" role and the right color for info/success', () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole('status')).toHaveClass('text-primary');

    rerender(<Alert variant="success">OK</Alert>);
    expect(screen.getByRole('status')).toHaveClass('text-success');
  });
});
