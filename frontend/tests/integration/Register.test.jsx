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

  it('redirects to the verification page after a successful sign-up without token', async () => {
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

    await user.type(screen.getByPlaceholderText(/jane doe/i), 'Jane Doe');
    await user.type(screen.getByPlaceholderText(/email@example.com/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Your password'), 'Pass1234');
    await user.type(screen.getByPlaceholderText(/confirm your password/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRegister).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'axelle@example.com',
      password: 'Pass1234',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/verify', {
      state: { email: 'axelle@example.com' },
    });
  });
});
