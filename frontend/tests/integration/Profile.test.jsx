import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Profile from '../../src/pages/Profile';
import { getHasUnsavedChanges } from '../../src/utils/unsavedChangesStore';

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
    <HelmetProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </HelmetProvider>,
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

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeEnabled();
  });

  it('keeps "Save changes" disabled until a field actually changes, then saves', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled(); // nothing changed yet — no false "updated"

    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Jane Smith');
    expect(save).toBeEnabled();

    await user.click(save);
    expect(authState.updateUserProfile).toHaveBeenCalledWith({
      name: 'Jane Smith',
      email: 'axelle@example.com',
    });
  });

  it('cancels edits, restores the original value and saves nothing', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Changed Name');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByDisplayValue('Jane Doe')).toBeDisabled();
    expect(authState.updateUserProfile).not.toHaveBeenCalled();
  });

  it('flags unsaved changes while editing, and clears them on save/cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(getHasUnsavedChanges()).toBe(false);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(getHasUnsavedChanges()).toBe(false); // no edits yet

    const nameField = screen.getByDisplayValue('Jane Doe');
    await user.clear(nameField);
    await user.type(nameField, 'Changed Name');
    expect(getHasUnsavedChanges()).toBe(true);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(getHasUnsavedChanges()).toBe(false);
  });

  it('opens the sign-out confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText(/you'll need to sign in again/i)).toBeInTheDocument();
  });
});

describe('Profile (demo account)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    Object.assign(authState, {
      user: {
        name: 'Demo',
        email: 'demo@frameset.app',
        avatarInitials: 'DM',
        passwordUpdatedAt: null,
        hasPassword: true,
        isDemo: true,
      },
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn(),
    });
  });

  it('hides Edit, Change password and Delete my account, showing explanatory text instead', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete my account/i })).not.toBeInTheDocument();

    expect(screen.getByText(/account settings aren.t editable in the demo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not available in the demo account/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/account deletion isn.t available in the demo/i)).toBeInTheDocument();
  });

  it('still allows signing out', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText(/you'll need to sign in again/i)).toBeInTheDocument();
  });
});
