import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '../../src/context/AuthContext';
import ReauthModal from '../../src/components/ReauthModal';

const renderModal = (user, props = {}) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <ReauthModal isOpen onClose={() => {}} onConfirm={vi.fn()} {...props} />
    </AuthContext.Provider>,
  );

describe('ReauthModal', () => {
  it('asks for the current password and passes it to onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({ success: true });
    renderModal({ hasPassword: true }, { onConfirm, confirmLabel: 'Save changes' });

    await user.type(screen.getByLabelText(/current password/i), 'Secret123');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onConfirm).toHaveBeenCalledWith({ currentPassword: 'Secret123' });
  });

  it('shows the failure returned by onConfirm inline and allows retrying', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'Current password is incorrect.' });
    renderModal({ hasPassword: true }, { onConfirm });

    await user.type(screen.getByLabelText(/current password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByText('Current password is incorrect.')).toBeInTheDocument(),
    );
  });

  it('refuses to submit an empty password', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderModal({ hasPassword: true }, { onConfirm });

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/enter your current password/i)).toBeInTheDocument();
  });

  it('offers the Google confirmation path for passwordless accounts', () => {
    renderModal({ hasPassword: false });

    // No password field: the account has none — identity is proven via Google.
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByText(/confirm with your google account/i)).toBeInTheDocument();
  });
});
