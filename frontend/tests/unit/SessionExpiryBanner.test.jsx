import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionExpiryBanner from '../../src/components/SessionExpiryBanner';

const { authState, mockShowToast } = vi.hoisted(() => ({
  authState: { sessionExpiringSoon: false, refreshAccessToken: vi.fn() },
  mockShowToast: vi.fn(),
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../src/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

describe('SessionExpiryBanner', () => {
  beforeEach(() => {
    authState.sessionExpiringSoon = false;
    authState.refreshAccessToken = vi.fn().mockResolvedValue(true);
    mockShowToast.mockReset();
  });

  it('renders nothing when the session is not expiring soon', () => {
    const { container } = render(<SessionExpiryBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a "stay signed in" prompt and renews the session on click', async () => {
    authState.sessionExpiringSoon = true;
    const user = userEvent.setup();
    render(<SessionExpiryBanner />);

    expect(screen.getByText(/session will expire soon/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));

    expect(authState.refreshAccessToken).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith("You're still signed in.", 'success'),
    );
  });

  it('shows a failure toast when renewal fails', async () => {
    authState.sessionExpiringSoon = true;
    authState.refreshAccessToken = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(<SessionExpiryBanner />);

    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('Failed to renew your session.', 'danger'),
    );
  });
});
