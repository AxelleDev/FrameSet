import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    <AuthContext.Provider value={{ login: mockLogin }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('Login', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
  });

  it('refuse de soumettre des champs vides', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /continuer/i }));
    expect(await screen.findByText(/remplir tous les champs/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('connecte et redirige vers le tableau de bord', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: true });
    renderPage();

    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Votre mot de passe'), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /continuer/i }));

    expect(mockLogin).toHaveBeenCalledWith('axelle@example.com', 'Pass1234');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard'));
  });

  it("affiche le message d'erreur renvoyé par l'API", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ success: false, message: 'Identifiants invalides' });
    renderPage();

    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'axelle@example.com');
    await user.type(screen.getByPlaceholderText('Votre mot de passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: /continuer/i }));

    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
