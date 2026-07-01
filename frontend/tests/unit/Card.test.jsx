import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Card from '../../src/components/Card';

describe('Card', () => {
  it('renders its content in a rounded surface', () => {
    render(<Card>Content</Card>);
    const el = screen.getByText('Content');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('rounded-3xl');
  });

  it('calls onClick when clickable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card clickable onClick={onClick}>Card</Card>);
    await user.click(screen.getByText('Card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
