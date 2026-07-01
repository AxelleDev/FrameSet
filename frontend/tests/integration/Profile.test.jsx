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
        name: 'Jane Doe',
        email: 'axelle@example.com',
        avatarInitials: 'JD',
        passwordUpdatedAt: null,
      },
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn(),
    });
  });

  it('shows the name, email and initials', () => {
    renderPage();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('axelle@example.com')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('switches to edit mode (editable fields + Save button)', async () => {
    const user = userEvent.setup();
    renderPage();

    // At rest: the name field is disabled (not editable).
    expect(screen.getByDisplayValue('Jane Doe')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /edit profile/i }));

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeEnabled();
  });

  it('opens the sign-out confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText(/you'll need to sign in again/i)).toBeInTheDocument();
  });
});
