import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import Verify from '../../src/pages/Verify';

const { mockNavigate, mockVerify, mockResend } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockVerify: vi.fn(),
  mockResend: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderPage = () =>
  render(
    <HelmetProvider>
      <AuthContext.Provider
        value={{
          verifyEmail: mockVerify,
          resendVerificationCode: mockResend,
          verifyPendingEmail: vi.fn(),
          resendPendingEmailCode: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/verify?email=axelle%40example.com']}>
          <Verify />
        </MemoryRouter>
      </AuthContext.Provider>
    </HelmetProvider>,
  );

describe('Verify', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockVerify.mockReset();
    mockResend.mockReset();
  });

  it('verifies the code and shows success', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: true });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(mockVerify).toHaveBeenCalledWith('axelle@example.com', '123456');
    expect(await screen.findByText(/verified/i)).toBeInTheDocument();
  });

  it('shows an error when the code is incorrect', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: false, message: 'Incorrect code' });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '000000');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText('Incorrect code')).toBeInTheDocument();
  });

  it('confirms when a fresh code was sent', async () => {
    const user = userEvent.setup();
    mockResend.mockResolvedValue({ success: true });
    renderPage();

    await user.click(screen.getByRole('button', { name: /resend code/i }));

    expect(mockResend).toHaveBeenCalledWith('axelle@example.com');
    expect(await screen.findByText(/code resent/i)).toBeInTheDocument();
  });

  it('surfaces a resend failure, rate-limit delay included', async () => {
    const user = userEvent.setup();
    mockResend.mockResolvedValue({
      success: false,
      message: 'Too many resend requests, try again in 10 minutes.',
      retryAfterSeconds: 600,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /resend code/i }));

    expect(await screen.findByText(/too many resend requests/i)).toBeInTheDocument();
  });

  it('falls back to a generic message when the resend fails without one', async () => {
    const user = userEvent.setup();
    mockResend.mockResolvedValue({ success: false });
    renderPage();

    await user.click(screen.getByRole('button', { name: /resend code/i }));

    expect(await screen.findByText(/something went wrong sending the code/i)).toBeInTheDocument();
  });

  // No email in the URL nor router state: the page falls back to manual entry
  // and both actions demand the email before calling the API.
  const renderPageWithoutEmail = () =>
    render(
      <HelmetProvider>
        <AuthContext.Provider
          value={{
            verifyEmail: mockVerify,
            resendVerificationCode: mockResend,
            verifyPendingEmail: vi.fn(),
            resendPendingEmailCode: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/verify']}>
            <Verify />
          </MemoryRouter>
        </AuthContext.Provider>
      </HelmetProvider>,
    );

  it('demands the email before verifying when none was provided', async () => {
    const user = userEvent.setup();
    renderPageWithoutEmail();

    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('demands the email before resending when none was provided', async () => {
    const user = userEvent.setup();
    renderPageWithoutEmail();

    await user.click(screen.getByRole('button', { name: /resend code/i }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it('accepts a manually typed email and resends to it', async () => {
    const user = userEvent.setup();
    mockResend.mockResolvedValue({ success: true });
    renderPageWithoutEmail();

    await user.type(screen.getByPlaceholderText('email@example.com'), 'axelle@example.com');
    await user.click(screen.getByRole('button', { name: /resend code/i }));

    expect(mockResend).toHaveBeenCalledWith('axelle@example.com');
    expect(await screen.findByText(/code resent/i)).toBeInTheDocument();
  });
});
