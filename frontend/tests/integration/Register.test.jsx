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
        email: 'axelle@example.com',
        is_verified: false
      }
    });

    renderPage();

    await user.type(screen.getByPlaceholderText(/prénom nom/i), 'Prénom Nom');
    await user.type(screen.getByPlaceholderText(/email@exemple.com/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Votre mot de passe'), 'Pass1234');
    await user.type(screen.getByPlaceholderText(/retapez votre mot de passe/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /créer un compte/i }));

    expect(mockRegister).toHaveBeenCalledWith({
      name: 'Prénom Nom',
      email: 'axelle@example.com',
      password: 'Pass1234'
    });
    expect(mockNavigate).toHaveBeenCalledWith('/verify?email=axelle%40example.com');
  });
});