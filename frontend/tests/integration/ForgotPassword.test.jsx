import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    <AuthContext.Provider value={{ requestPasswordReset: mockRequest, resetPassword: mockReset }}>
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest.mockReset();
    mockReset.mockReset();
  });

  it('enchaîne la demande de code puis la réinitialisation', async () => {
    const user = userEvent.setup();
    mockRequest.mockResolvedValue({ success: true });
    mockReset.mockResolvedValue({ success: true });
    renderPage();

    // Étape 1 : demande du code.
    await user.type(screen.getByPlaceholderText(/email@exemple/i), 'axelle@example.com');
    await user.click(screen.getByRole('button', { name: /envoyer le code/i }));
    expect(mockRequest).toHaveBeenCalledWith('axelle@example.com');

    // Étape 2 : le formulaire de réinitialisation apparaît.
    const code = await screen.findByPlaceholderText('123456');
    await user.type(code, '654321');
    await user.type(screen.getByPlaceholderText(/votre nouveau mot de passe/i), 'Pass1234');
    await user.type(screen.getByPlaceholderText(/confirmez votre mot de passe/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /réinitialiser le mot de passe/i }));

    expect(mockReset).toHaveBeenCalledWith('axelle@example.com', '654321', 'Pass1234');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});
