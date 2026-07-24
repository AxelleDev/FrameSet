import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Landing from '../../src/pages/Landing';

const { authState, toastState, navigateMock } = vi.hoisted(() => ({
  authState: { loginAsDemo: vi.fn() },
  toastState: { showToast: vi.fn() },
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => toastState }));

// The Reveal helper observes elements to fade them in; jsdom has no
// IntersectionObserver, so stub one that never fires (content still renders).
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const renderLanding = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('Landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the hero actions and the drawing-app palette formats in the export feature', () => {
    renderLanding();

    // Two "Create account" CTAs by design: the hero and the bottom section.
    expect(screen.getAllByRole('link', { name: /create account/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /try the demo/i })).toBeInTheDocument();
    // The export mock advertises the three drawing-app palette formats.
    expect(screen.getByText('Photoshop / Illustrator')).toBeInTheDocument();
    expect(screen.getByText('.gpl')).toBeInTheDocument();
    expect(screen.getByText('.swatches')).toBeInTheDocument();
  });

  it('enters the demo and lands on the dashboard on success', async () => {
    const user = userEvent.setup();
    authState.loginAsDemo.mockResolvedValue({ success: true });
    renderLanding();

    await user.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(authState.loginAsDemo).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard');
  });

  it('surfaces a toast instead of navigating when the demo is unavailable', async () => {
    const user = userEvent.setup();
    authState.loginAsDemo.mockResolvedValue({ success: false, message: 'Demo unavailable.' });
    renderLanding();

    await user.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(toastState.showToast).toHaveBeenCalledWith('Demo unavailable.', 'danger');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
