import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import Login from '../../src/pages/Login';

const { mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../src/hooks/useUserCount', () => ({ default: () => 12 }));

const renderPage = () =>
  render(
    <HelmetProvider>
      <AuthContext.Provider value={{ login: mockLogin }}>
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
});
