import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../src/context/AuthContext';
import Register from '../../src/pages/Register';

const { mockNavigate, mockRegister } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRegister: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../src/hooks/useUserCount', () => ({
  default: () => 12
}));

const renderPage = () => {
  render(
    <AuthContext.Provider value={{ register: mockRegister }}>
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('Register', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRegister.mockReset();
  });

  it('redirige vers la page de vérification après une inscription réussie sans token', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        email: 'axel@a.com',
        is_verified: false
      }
    });

    renderPage();

    await user.type(screen.getByPlaceholderText(/prénom nom/i), 'Axel Nom');
    await user.type(screen.getByPlaceholderText(/email@exemple.com/i), 'axel@a.com');
    await user.type(screen.getByPlaceholderText(/8\+ caractères/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /créer un compte/i }));

    expect(mockRegister).toHaveBeenCalledWith({
      name: 'Axel Nom',
      email: 'axel@a.com',
      password: 'Pass1234'
    });
    expect(mockNavigate).toHaveBeenCalledWith('/verify?email=axel%40a.com');
  });
});