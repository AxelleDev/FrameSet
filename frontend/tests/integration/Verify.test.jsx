import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
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
    <HelmetProvider>
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
    </HelmetProvider>,
  );

describe('Verify', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockVerify.mockReset();
    mockResend.mockReset();
  });

  it('verifies the code and shows success', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: true });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(mockVerify).toHaveBeenCalledWith('axelle@example.com', '123456');
    expect(await screen.findByText(/verified/i)).toBeInTheDocument();
  });

  it('shows an error when the code is incorrect', async () => {
    const user = userEvent.setup();
    mockVerify.mockResolvedValue({ success: false, message: 'Incorrect code' });
    renderPage();

    await user.type(screen.getByPlaceholderText('123456'), '000000');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText('Incorrect code')).toBeInTheDocument();
  });
});
