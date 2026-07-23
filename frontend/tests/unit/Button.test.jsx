import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Button from '../../src/components/Button';

describe('Button', () => {
  it('renders its content in a <button> by default', () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('calls onClick on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Submit
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows the loading state (aria-busy + disabled)', () => {
    render(<Button loading>Send</Button>);
    const btn = screen.getByRole('button', { name: 'Send' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    ['primary', 'bg-blue'],
    ['danger', 'bg-danger'],
    ['ghost', 'bg-transparent'],
    ['outline', 'bg-blue/10'],
  ])('applies the %s variant', (variant, expectedClass) => {
    render(<Button variant={variant}>X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass(expectedClass);
  });

  it('renders a link when `to` is provided', () => {
    render(
      <MemoryRouter>
        <Button to="/app/dashboard">Back</Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Back' });
    expect(link).toHaveAttribute('href', '/app/dashboard');
  });
});
