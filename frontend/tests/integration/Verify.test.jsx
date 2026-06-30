import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../src/context/AuthContext';
import Verify from '../../src/pages/Verify';

const { mockNavigate, mockVerify, mockResend } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockVerify: vi.fn(),
  mockResend: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderPage = () =>
  render(
    <AuthContext.Provider
      value={{
        verifyEmail: mockVerify,
        resendVerificationCode: mockResend,
        verifyPendingEmail: vi.fn(),
        resendPendingEmailCode: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/verify?email=axelle%40example.com']}>
        <Verify />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('Verify', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockVerify.mockReset();
    mockResend.mockReset();
  });

  it('vérifie le code et affiche le succès', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: true });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '123456');
    await user.click(screen.getByRole('button', { name: /^vérifier$/i }));

    expect(mockVerify).toHaveBeenCalledWith('axelle@example.com', '123456');
    expect(await screen.findByText(/vérifié/i)).toBeInTheDocument();
  });

  it('affiche une erreur quand le code est incorrect', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: false, message: 'Code incorrect' });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '000000');
    await user.click(screen.getByRole('button', { name: /^vérifier$/i }));

    expect(await screen.findByText('Code incorrect')).toBeInTheDocument();
  });
});
