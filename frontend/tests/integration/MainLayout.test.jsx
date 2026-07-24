import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import MainLayout from '../../src/layouts/MainLayout';
import { setHasUnsavedChanges } from '../../src/utils/unsavedChangesStore';

const { authState, projectState } = vi.hoisted(() => ({
  authState: { user: { name: 'Jane Doe', avatarInitials: 'JD' }, authLoading: false },
  projectState: { activeProject: null, projects: [], projectsLoading: false },
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../src/context/ProjectContext', () => ({ useProjects: () => projectState }));

const renderLayout = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route path="/app" element={<MainLayout />}>
            <Route path="dashboard" element={<div>Dashboard page</div>} />
            <Route path="profile" element={<div>Profile page</div>} />
          </Route>
          <Route path="/register" element={<div>Register page</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('MainLayout unsaved-changes navigation guard', () => {
  afterEach(() => {
    setHasUnsavedChanges(false);
  });

  it('navigates freely when there are no unsaved changes', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('link', { name: /jane doe/i }));

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('blocks in-app navigation when dirty and the user cancels the confirm', async () => {
    setHasUnsavedChanges(true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('link', { name: /jane doe/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('allows in-app navigation when dirty and the user confirms leaving', async () => {
    setHasUnsavedChanges(true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('link', { name: /jane doe/i }));

    expect(screen.getByText('Profile page')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});

describe('MainLayout demo account banner', () => {
  afterEach(() => {
    authState.user = { name: 'Jane Doe', avatarInitials: 'JD' };
  });

  it('is not shown for a normal account', () => {
    renderLayout();
    expect(screen.queryByText(/read-only demo/i)).not.toBeInTheDocument();
  });

  it('is shown for the demo account and signs out before going to /register', async () => {
    const logout = vi.fn().mockResolvedValue();
    authState.user = { name: 'Demo', avatarInitials: 'DM', isDemo: true };
    authState.logout = logout;
    const user = userEvent.setup();
    renderLayout();

    expect(screen.getByText(/read-only demo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create a free account/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Register page')).toBeInTheDocument();
  });
});
