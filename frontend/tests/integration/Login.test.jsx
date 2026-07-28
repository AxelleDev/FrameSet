import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import Login from '../../src/pages/Login';

const { mockNavigate, mockLogin, mockLoginAsDemo, mockCompleteTotpLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
  mockLoginAsDemo: vi.fn(),
  mockCompleteTotpLogin: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../src/hooks/useUserCount', () => ({ default: () => 12 }));

const renderPage = () =>
  render(
    <HelmetProvider>
      <AuthContext.Provider
        value={{
          login: mockLogin,
          loginAsDemo: mockLoginAsDemo,
          completeTotpLogin: mockCompleteTotpLogin,
        }}
      >
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>
    </HelmetProvider>,
  );

describe('Login', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockLoginAsDemo.mockReset();
    mockCompleteTotpLogin.mockReset();
  });

  it('refuses to submit empty fields', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/enter your email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('signs in and redirects to the dashboard', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: true });
    renderPage();

    await user.type(screen.getByPlaceholderText(/email@example/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Your password'), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('axelle@example.com', 'Pass1234');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard'));
  });

  it('shows the error message returned by the API', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: false, message: 'Invalid credentials' });
    renderPage();

    await user.type(screen.getByPlaceholderText(/email@example/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Your password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('"Try the demo" logs in as the demo account and redirects to the dashboard', async () => {
    const user = userEvent.setup();
    mockLoginAsDemo.mockResolvedValue({ success: true });
    renderPage();

    await user.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(mockLoginAsDemo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard'));
  });

  it('shows the error message when the demo login fails', async () => {
    const user = userEvent.setup();
    mockLoginAsDemo.mockResolvedValue({ success: false, message: 'The demo is not available.' });
    renderPage();

    await user.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(await screen.findByText('The demo is not available.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe('two-factor authentication step', () => {
    const signInWithPassword = async (user) => {
      await user.type(screen.getByPlaceholderText(/email@example/i), 'axelle@example.com');
      await user.type(screen.getByPlaceholderText('Your password'), 'Pass1234');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
    };

    it('switches to the code-entry step when the account has 2FA enabled', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
      renderPage();

      await signInWithPassword(user);

      expect(await screen.findByText(/two-factor authentication/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('completes sign-in and redirects once the code is correct', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
      mockCompleteTotpLogin.mockResolvedValue({ success: true });
      renderPage();

      await signInWithPassword(user);
      await user.type(await screen.findByLabelText(/verification code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      expect(mockCompleteTotpLogin).toHaveBeenCalledWith('tok-1', '123456');
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard'));
    });

    it('shows an inline error for an incorrect code, without navigating', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
      mockCompleteTotpLogin.mockResolvedValue({ success: false, message: 'Incorrect code.' });
      renderPage();

      await signInWithPassword(user);
      await user.type(await screen.findByLabelText(/verification code/i), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      expect(await screen.findByText('Incorrect code.')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('switches to the recovery-code label and back', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
      renderPage();

      await signInWithPassword(user);
      await screen.findByLabelText(/verification code/i);

      await user.click(screen.getByRole('button', { name: /use a recovery code instead/i }));
      expect(screen.getByLabelText(/recovery code/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /use my authenticator app instead/i }));
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    it('opens directly on the code-entry step when a challenge arrives via route state (Google on the register page)', async () => {
      render(
        <HelmetProvider>
          <AuthContext.Provider
            value={{
              login: mockLogin,
              loginAsDemo: mockLoginAsDemo,
              completeTotpLogin: mockCompleteTotpLogin,
            }}
          >
            <MemoryRouter
              initialEntries={[{ pathname: '/login', state: { totpChallengeToken: 'tok-r' } }]}
            >
              <Login />
            </MemoryRouter>
          </AuthContext.Provider>
        </HelmetProvider>,
      );

      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();

      const user = userEvent.setup();
      mockCompleteTotpLogin.mockResolvedValue({ success: true });
      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      expect(mockCompleteTotpLogin).toHaveBeenCalledWith('tok-r', '123456');
    });

    it('"Back to sign in" returns to the email/password form', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
      renderPage();

      await signInWithPassword(user);
      await screen.findByLabelText(/verification code/i);

      await user.click(screen.getByRole('button', { name: /back to sign in/i }));

      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    });
  });
});
