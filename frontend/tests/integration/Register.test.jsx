import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import Register from '../../src/pages/Register';

const { mockNavigate, mockRegister } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRegister: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/hooks/useUserCount', () => ({
  default: () => 12,
}));

const renderPage = () => {
  render(
    <HelmetProvider>
      <AuthContext.Provider value={{ register: mockRegister }}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </AuthContext.Provider>
    </HelmetProvider>,
  );
};

describe('Register', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRegister.mockReset();
  });

  // 10s budget: four userEvent.type() calls add up, and under a fully parallel
  // suite run this test can brush past the 5s default on a loaded machine.
  it(
    'redirects to the verification page after a successful sign-up without token',
    { timeout: 10_000 },
    async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          email: 'axelle@example.com',
          is_verified: false,
        },
      });

      renderPage();

      // Step 1: identity.
      expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
      await user.type(screen.getByLabelText(/username/i), 'AxelleDev');
      await user.type(screen.getByPlaceholderText(/email@example.com/i), 'axelle@example.com');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 2: password.
      expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('Your password'), 'Pass1234');
      await user.type(screen.getByPlaceholderText(/confirm your password/i), 'Pass1234');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(mockRegister).toHaveBeenCalledWith({
        name: 'AxelleDev',
        email: 'axelle@example.com',
        password: 'Pass1234',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/verify', {
        state: { email: 'axelle@example.com' },
      });
    },
  );

  it('gates the Continue button until the identity step is valid', async () => {
    const user = userEvent.setup();
    renderPage();

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    await user.type(screen.getByLabelText(/username/i), 'AxelleDev');
    await user.type(screen.getByPlaceholderText(/email@example.com/i), 'not-an-email');
    expect(continueButton).toBeDisabled();
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/email@example.com/i));
    await user.type(screen.getByPlaceholderText(/email@example.com/i), 'axelle@example.com');
    expect(continueButton).toBeEnabled();
  });

  it('goes back from the password step without losing what was typed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/username/i), 'AxelleDev');
    await user.type(screen.getByPlaceholderText(/email@example.com/i), 'axelle@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.type(screen.getByPlaceholderText('Your password'), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /back to username and email/i }));

    // Step 1 again, values preserved.
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toHaveValue('AxelleDev');
    expect(screen.getByPlaceholderText(/email@example.com/i)).toHaveValue('axelle@example.com');

    // And the password survives the round trip too.
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByPlaceholderText('Your password')).toHaveValue('Pass1234');
  });
});
