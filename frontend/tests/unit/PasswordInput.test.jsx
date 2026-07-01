import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../../src/components/PasswordInput';

describe('PasswordInput', () => {
  it('masks the value and toggles to plain text on click (filled field)', async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} placeholder="Password" />);

    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does not show the eye icon when the field is empty', () => {
    render(<PasswordInput value="" onChange={() => {}} placeholder="Password" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('can be disabled (field + button)', () => {
    render(<PasswordInput value="secret" onChange={() => {}} placeholder="pw" disabled />);
    expect(screen.getByPlaceholderText('pw')).toBeDisabled();
    expect(screen.getByRole('button', { name: /show password/i })).toBeDisabled();
  });
});
