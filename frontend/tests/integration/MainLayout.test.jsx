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

  it('blocks in-app navigation when dirty and the user cancels the styled dialog', async () => {
    setHasUnsavedChanges(true);
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('link', { name: /jane doe/i }));

    expect(
      screen.getByText('You have unsaved changes. Leave this page without saving?'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('allows in-app navigation when dirty and the user confirms leaving via the styled dialog', async () => {
    setHasUnsavedChanges(true);
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('link', { name: /jane doe/i }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });
});

describe('MainLayout global search', () => {
  it('opens with Ctrl+K, closes with Escape, and opens via the header button', async () => {
    const user = userEvent.setup();
    renderLayout();

    expect(screen.queryByRole('searchbox')).toBeNull();
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('searchbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('searchbox')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });
});

describe('MainLayout mobile drawer', () => {
  it('opens via the burger button, moves focus inside, and closes on Escape', async () => {
    const user = userEvent.setup();
    renderLayout();

    const aside = document.querySelector('aside');
    expect(aside.className).toContain('invisible');

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(aside.className).not.toContain('invisible');
    // Focus lands inside the drawer so keyboard users aren't left behind the overlay.
    expect(aside.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(aside.className).toContain('invisible');
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByRole('button', { name: /close menu/i }));

    expect(document.querySelector('aside').className).toContain('invisible');
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('keeps Tab cycling inside the open drawer (focus trap)', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const aside = document.querySelector('aside');

    // Tab far more times than the drawer has focusable elements: focus must
    // never escape to the content masked behind the overlay.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(aside.contains(document.activeElement)).toBe(true);
    }
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
    // The banner leaves via a hard document navigation (immune to the route
    // guard racing the router — see DemoAccountBanner), which jsdom does not
    // perform; stub location.assign to observe it instead.
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign },
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();
    renderLayout();

    expect(screen.getByText(/read-only demo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create a free account/i }));

    // The demo session must be revoked before the redirect, so the register
    // page never loads with the shared demo cookies still active.
    expect(logout).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/register');
    expect(logout.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0]);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});
