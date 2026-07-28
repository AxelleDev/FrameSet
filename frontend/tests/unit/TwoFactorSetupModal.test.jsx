import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '../../src/context/AuthContext';
import TwoFactorSetupModal from '../../src/components/TwoFactorSetupModal';

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

const renderModal = (authValue, props = {}) =>
  render(
    <AuthContext.Provider value={authValue}>
      <TwoFactorSetupModal isOpen onClose={vi.fn()} {...props} />
    </AuthContext.Provider>,
  );

describe('TwoFactorSetupModal', () => {
  it('loads the secret, renders the QR code and the manual-entry fallback', async () => {
    const setupTotp = vi.fn().mockResolvedValue({
      success: true,
      secret: 'ABCD1234EFGH5678',
      otpauthUrl: 'otpauth://totp/FrameSet:axelle@example.com?secret=ABCD1234EFGH5678',
    });
    renderModal({ setupTotp, confirmTotpSetup: vi.fn() });

    expect(screen.getByText(/generating your secret/i)).toBeInTheDocument();

    expect(await screen.findByText('ABCD1234EFGH5678')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByAltText(/qr code/i)).toHaveAttribute('src', 'data:image/png;base64,fake'),
    );
  });

  it('shows the setup failure inline and lets the user close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const setupTotp = vi.fn().mockResolvedValue({
      success: false,
      message: 'Too many attempts.',
      retryAfterSeconds: 30,
    });
    renderModal({ setupTotp, confirmTotpSetup: vi.fn() }, { onClose });

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses to confirm an empty code', async () => {
    const user = userEvent.setup();
    const setupTotp = vi.fn().mockResolvedValue({
      success: true,
      secret: 'ABCD1234EFGH5678',
      otpauthUrl: 'otpauth://totp/x',
    });
    const confirmTotpSetup = vi.fn();
    renderModal({ setupTotp, confirmTotpSetup });

    await screen.findByText('ABCD1234EFGH5678');
    await user.click(screen.getByRole('button', { name: /^enable$/i }));

    expect(confirmTotpSetup).not.toHaveBeenCalled();
    expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
  });

  it('shows an incorrect-code error inline without leaving the scan step', async () => {
    const user = userEvent.setup();
    const setupTotp = vi.fn().mockResolvedValue({
      success: true,
      secret: 'ABCD1234EFGH5678',
      otpauthUrl: 'otpauth://totp/x',
    });
    const confirmTotpSetup = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'Incorrect code.', retryAfterSeconds: 5 });
    renderModal({ setupTotp, confirmTotpSetup });

    await screen.findByText('ABCD1234EFGH5678');
    await user.type(screen.getByLabelText(/verification code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^enable$/i }));

    expect(await screen.findByText(/incorrect code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('"Cancel" abandons setup without enabling anything', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEnabled = vi.fn();
    const setupTotp = vi.fn().mockResolvedValue({
      success: true,
      secret: 'ABCD1234EFGH5678',
      otpauthUrl: 'otpauth://totp/x',
    });
    renderModal({ setupTotp, confirmTotpSetup: vi.fn() }, { onClose, onEnabled });

    await screen.findByText('ABCD1234EFGH5678');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEnabled).not.toHaveBeenCalled();
  });

  it('shows the recovery codes once confirmed, copies them, and only then calls onEnabled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEnabled = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const setupTotp = vi.fn().mockResolvedValue({
      success: true,
      secret: 'ABCD1234EFGH5678',
      otpauthUrl: 'otpauth://totp/x',
    });
    const confirmTotpSetup = vi.fn().mockResolvedValue({
      success: true,
      recoveryCodes: ['AAAAA-BBBBB-CCCCC-DDDDD', 'EEEEE-FFFFF-GGGGG-HHHHH'],
    });
    renderModal({ setupTotp, confirmTotpSetup }, { onClose, onEnabled });

    await screen.findByText('ABCD1234EFGH5678');
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^enable$/i }));

    expect(confirmTotpSetup).toHaveBeenCalledWith('123456');
    expect(await screen.findByText('AAAAA-BBBBB-CCCCC-DDDDD')).toBeInTheDocument();
    expect(screen.getByText('EEEEE-FFFFF-GGGGG-HHHHH')).toBeInTheDocument();
    expect(onEnabled).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /copy all codes/i }));
    expect(writeText).toHaveBeenCalledWith('AAAAA-BBBBB-CCCCC-DDDDD\nEEEEE-FFFFF-GGGGG-HHHHH');

    await user.click(screen.getByRole('button', { name: /saved my recovery codes/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEnabled).toHaveBeenCalledTimes(1);
  });
});
