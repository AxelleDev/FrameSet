import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../../src/pages/Profile';

const { mockNavigate, authState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  authState: {},
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => authState,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );

describe('Profile', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(authState, {
      user: {
        name: 'Prénom Nom',
        email: 'axelle@example.com',
        avatarInitials: 'AT',
        passwordUpdatedAt: null,
      },
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn(),
    });
  });

  it('affiche le nom, l’email et les initiales', () => {
    renderPage();
    expect(screen.getByText('Prénom Nom')).toBeInTheDocument();
    expect(screen.getByText('axelle@example.com')).toBeInTheDocument();
    expect(screen.getByText('AT')).toBeInTheDocument();
  });

  it('bascule en mode édition (champs éditables + bouton Enregistrer)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Au repos : le champ nom est désactivé (non éditable).
    expect(screen.getByDisplayValue('Prénom Nom')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /éditer le profil/i }));

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Prénom Nom')).toBeEnabled();
  });

  it('ouvre la confirmation de déconnexion', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /déconnexion/i }));
    expect(await screen.findByText(/vous déconnecter/i)).toBeInTheDocument();
  });
});
