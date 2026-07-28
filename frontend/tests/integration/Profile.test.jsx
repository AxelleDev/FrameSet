import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Profile from '../../src/pages/Profile';
import { getHasUnsavedChanges } from '../../src/utils/unsavedChangesStore';

const { mockNavigate, authState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  authState: {},
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => authState,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('Profile', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(authState, {
      user: {
        name: 'Jane Doe',
        email: 'axelle@example.com',
        avatarInitials: 'JD',
        passwordUpdatedAt: null,
        totpEnabled: false,
      },
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn(),
      setupTotp: vi.fn().mockResolvedValue({
        success: true,
        secret: 'ABCD1234EFGH5678',
        otpauthUrl: 'otpauth://totp/FrameSet:axelle@example.com?secret=ABCD1234EFGH5678',
      }),
      confirmTotpSetup: vi.fn(),
      disableTotp: vi.fn(),
    });
  });

  it('shows the name, email and initials', () => {
    renderPage();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('axelle@example.com')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('switches to edit mode (editable fields + Save button)', async () => {
    const user = userEvent.setup();
    renderPage();

    // At rest: the name field is disabled (not editable).
    expect(screen.getByDisplayValue('Jane Doe')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeEnabled();
  });

  it('keeps "Save changes" disabled until a field actually changes, then saves', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled(); // nothing changed yet — no false "updated"

    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Jane Smith');
    expect(save).toBeEnabled();

    await user.click(save);
    expect(authState.updateUserProfile).toHaveBeenCalledWith({
      name: 'Jane Smith',
      email: 'axelle@example.com',
    });
  });

  it('cancels edits, restores the original value and saves nothing', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Changed Name');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByDisplayValue('Jane Doe')).toBeDisabled();
    expect(authState.updateUserProfile).not.toHaveBeenCalled();
  });

  it('flags unsaved changes while editing, and clears them on save/cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(getHasUnsavedChanges()).toBe(false);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(getHasUnsavedChanges()).toBe(false); // no edits yet

    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Changed Name');
    expect(getHasUnsavedChanges()).toBe(true);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(getHasUnsavedChanges()).toBe(false);
  });

  it('opens the sign-out confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText(/you'll need to sign in again/i)).toBeInTheDocument();
  });

  it('routes an email change through re-authentication before saving', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const emailField = screen.getByDisplayValue('axelle@example.com');
    await user.clear(emailField);
    await user.type(emailField, 'new@example.com');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Nothing is saved yet: the critical action first demands the password.
    expect(authState.updateUserProfile).not.toHaveBeenCalled();
    expect(await screen.findByText(/confirm your identity/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/current password/i), 'Sup3rSecret!');
    const dialogSave = screen
      .getAllByRole('button', { name: /save changes/i })
      .find((button) => button.getAttribute('type') === 'submit');
    await user.click(dialogSave);

    expect(authState.updateUserProfile).toHaveBeenCalledWith(
      { name: 'Jane Doe', email: 'new@example.com' },
      { currentPassword: 'Sup3rSecret!' },
    );
  });

  it('surfaces a wrong password inline in the re-auth modal and stays open', async () => {
    const user = userEvent.setup();
    authState.updateUserProfile = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'Current password is incorrect.' });
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const emailField = screen.getByDisplayValue('axelle@example.com');
    await user.clear(emailField);
    await user.type(emailField, 'new@example.com');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await user.type(await screen.findByLabelText(/current password/i), 'wrong');
    const dialogSave = screen
      .getAllByRole('button', { name: /save changes/i })
      .find((button) => button.getAttribute('type') === 'submit');
    await user.click(dialogSave);

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
    // The modal stays open so the user can retry.
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('deletes the account after the typed confirmation and re-authentication', async () => {
    const user = userEvent.setup();
    authState.deleteAccount = vi.fn().mockResolvedValue({ success: true });
    renderPage();

    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    // Step 1: the type-to-confirm dialog gates the destructive intent.
    const confirmInput = await screen.findByLabelText(/type the confirmation word/i);
    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    expect(confirmButton).toBeDisabled();
    await user.type(confirmInput, 'DELETE');
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    // Step 2: a session alone is not enough — the password is required.
    expect(authState.deleteAccount).not.toHaveBeenCalled();
    await user.type(await screen.findByLabelText(/current password/i), 'Sup3rSecret!');
    const dialogDelete = screen
      .getAllByRole('button', { name: /delete my account/i })
      .find((button) => button.getAttribute('type') === 'submit');
    await user.click(dialogDelete);

    expect(authState.deleteAccount).toHaveBeenCalledWith({ currentPassword: 'Sup3rSecret!' });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  describe('two-factor authentication', () => {
    it('shows "Disabled" and an Enable button, which opens the setup modal', async () => {
      const user = userEvent.setup();
      renderPage();

      expect(screen.getByText('Disabled')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^enable$/i }));

      expect(authState.setupTotp).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/enter this code manually/i)).toBeInTheDocument();
      expect(screen.getByText('ABCD1234EFGH5678')).toBeInTheDocument();
    });

    it('confirming the code shows the one-time recovery codes', async () => {
      const user = userEvent.setup();
      authState.confirmTotpSetup.mockResolvedValue({
        success: true,
        recoveryCodes: ['AAAAA-BBBBB-CCCCC-DDDDD'],
      });
      renderPage();

      await user.click(screen.getByRole('button', { name: /^enable$/i }));
      await user.type(await screen.findByLabelText(/verification code/i), '123456');
      const modalEnableButton = screen
        .getAllByRole('button', { name: /^enable$/i })
        .find((button) => button.getAttribute('type') === 'submit');
      await user.click(modalEnableButton);

      expect(authState.confirmTotpSetup).toHaveBeenCalledWith('123456');
      expect(await screen.findByText('AAAAA-BBBBB-CCCCC-DDDDD')).toBeInTheDocument();
      expect(screen.getByText(/won.t be able to see these again/i)).toBeInTheDocument();
    });

    it('shows how many recovery codes remain, with a warning when running low', () => {
      authState.user.totpEnabled = true;
      authState.user.recoveryCodesRemaining = 8;
      const { unmount } = renderPage();
      expect(screen.getByText(/8 recovery codes remaining\./)).toBeInTheDocument();
      expect(screen.queryByText(/get a fresh set/i)).not.toBeInTheDocument();
      unmount();

      // At 1 left, the count switches to the singular warning wording.
      authState.user.recoveryCodesRemaining = 1;
      renderPage();
      expect(screen.getByText(/1 recovery code remaining\./)).toBeInTheDocument();
      expect(screen.getByText(/disable and re-enable 2fa to get a fresh set/i)).toBeInTheDocument();
    });

    it('shows "Enabled" and a Disable button, which requires re-authentication', async () => {
      const user = userEvent.setup();
      authState.user.totpEnabled = true;
      authState.disableTotp.mockResolvedValue({ success: true });
      renderPage();

      expect(screen.getByText('Enabled')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^disable$/i }));

      expect(authState.disableTotp).not.toHaveBeenCalled();
      await user.type(await screen.findByLabelText(/current password/i), 'Sup3rSecret!');
      const dialogDisable = screen
        .getAllByRole('button', { name: /disable 2fa/i })
        .find((button) => button.getAttribute('type') === 'submit');
      await user.click(dialogDisable);

      expect(authState.disableTotp).toHaveBeenCalledWith({ currentPassword: 'Sup3rSecret!' });
    });
  });
});

describe('Profile (demo account)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(authState, {
      user: {
        name: 'Demo',
        email: 'demo@frameset.app',
        avatarInitials: 'DM',
        passwordUpdatedAt: null,
        hasPassword: true,
        isDemo: true,
      },
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn(),
    });
  });

  it('hides Edit, Change password and Delete my account, showing explanatory text instead', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete my account/i })).not.toBeInTheDocument();

    expect(screen.getByText(/account settings aren.t editable in the demo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not available in the demo account/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/account deletion isn.t available in the demo/i)).toBeInTheDocument();
  });

  it('still allows signing out', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText(/you'll need to sign in again/i)).toBeInTheDocument();
  });
});
