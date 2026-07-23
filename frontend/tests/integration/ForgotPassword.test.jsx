import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import ForgotPassword from '../../src/pages/ForgotPassword';

const { mockNavigate, mockRequest, mockReset } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequest: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderPage = () =>
  render(
    <HelmetProvider>
      <AuthContext.Provider value={{ requestPasswordReset: mockRequest, resetPassword: mockReset }}>
        <MemoryRouter>
          <ForgotPassword />
        </MemoryRouter>
      </AuthContext.Provider>
    </HelmetProvider>,
  );

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest.mockReset();
    mockReset.mockReset();
  });

  // Heavy two-step form flow (lots of typing through jsdom): give it more than
  // the default 5s so it doesn't flake when all test files run in parallel.
  it('chains the code request then the reset', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    mockRequest.mockResolvedValue({ success: true });
    mockReset.mockResolvedValue({ success: true });
    renderPage();

    // Step 1: request the code.
    await user.type(screen.getByPlaceholderText(/email@example/i), 'axelle@example.com');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    expect(mockRequest).toHaveBeenCalledWith('axelle@example.com');

    // Step 2: the reset form appears.
    const code = await screen.findByPlaceholderText('123456');
    await user.type(code, '654321');
    await user.type(screen.getByPlaceholderText(/your new password/i), 'Pass1234');
    await user.type(screen.getByPlaceholderText(/confirm your password/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(mockReset).toHaveBeenCalledWith('axelle@example.com', '654321', 'Pass1234');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});
