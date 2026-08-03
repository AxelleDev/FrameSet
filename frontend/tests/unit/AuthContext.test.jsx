import React from 'react';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

const {
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiPatch,
  mockApiDelete,
  mockSetSessionExpiredHandler,
  mockSetSessionRefreshedHandler,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  mockSetSessionExpiredHandler: vi.fn(),
  mockSetSessionRefreshedHandler: vi.fn(),
}));

vi.mock('../../src/services/api', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
  setSessionExpiredHandler: mockSetSessionExpiredHandler,
  setSessionRefreshedHandler: mockSetSessionRefreshedHandler,
}));

// Registration effects re-run on every render that changes their deps, and the
// cleanup calls the setter with null — so the *last truthy* call is the
// currently-active handler.
const latestRegisteredHandler = (mockSetter) => {
  const calls = mockSetter.mock.calls.filter(([handler]) => typeof handler === 'function');
  return calls[calls.length - 1]?.[0];
};

vi.mock('../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const AuthProbe = () => {
  const { user, authLoading, globalError, sessionExpiringSoon } = useAuth();

  return (
    <div>
      <p data-testid="auth-loading">{String(authLoading)}</p>
      <p data-testid="user-email">{user?.email || ''}</p>
      <p data-testid="global-error">{globalError || ''}</p>
      <p data-testid="session-expiring-soon">{String(sessionExpiringSoon)}</p>
    </div>
  );
};

const renderProvider = () => {
  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
};

const buildHttpError = (status, message = 'HTTP error') => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// The mount-time profile probe only runs when the session hint is present:
// unless a test says otherwise, simulate a browser that had a session.
beforeEach(() => {
  localStorage.setItem('frameset-session', '1');
});
afterEach(() => {
  localStorage.clear();
});

describe('AuthContext session hydration', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiPatch.mockReset();
    mockApiDelete.mockReset();
    mockSetSessionExpiredHandler.mockClear();
    mockSetSessionRefreshedHandler.mockClear();
  });

  it('skips the profile probe entirely on a browser with no session hint', async () => {
    localStorage.clear();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('false'));

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-email')).toHaveTextContent('');
  });

  it('drops the hint after a hard 401 so the next visit skips the probe too', async () => {
    mockApiGet.mockRejectedValueOnce(buildHttpError(401));
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('false'));

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('frameset-session')).toBeNull();
  });

  it('sets the hint when a session opens and clears it on logout', async () => {
    localStorage.clear();
    const Actions = () => {
      const { login, logout } = useAuth();
      return (
        <div>
          <button type="button" onClick={() => login('axelle@example.com', 'Pass1234')}>
            do-login
          </button>
          <button type="button" onClick={() => logout()}>
            do-logout
          </button>
        </div>
      );
    };
    render(
      <AuthProvider>
        <Actions />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    mockApiPost.mockResolvedValueOnce({ success: true, id: 1, name: 'Axelle' });
    await user.click(screen.getByRole('button', { name: 'do-login' }));
    await waitFor(() => expect(localStorage.getItem('frameset-session')).toBe('1'));

    mockApiPost.mockResolvedValueOnce({ success: true });
    await user.click(screen.getByRole('button', { name: 'do-logout' }));
    await waitFor(() => expect(localStorage.getItem('frameset-session')).toBeNull());
  });

  it('hydrates the user when /profile returns 200', async () => {
    mockApiGet.mockResolvedValueOnce({ id: 1, email: 'axelle@example.fr' });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user-email')).toHaveTextContent('axelle@example.fr');
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/users/profile', { skipTokenRefresh: true });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('stays signed out when /profile returns 401', async () => {
    mockApiGet.mockRejectedValueOnce(buildHttpError(401, 'Unauthorized'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user-email')).toBeEmptyDOMElement();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('attempts a refresh when /profile returns 403 and hydrates the user on success', async () => {
    mockApiGet
      .mockRejectedValueOnce(buildHttpError(403, 'Forbidden'))
      .mockResolvedValueOnce({ id: 1, email: 'axelle@example.fr' });
    mockApiPost.mockResolvedValueOnce({ success: true });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user-email')).toHaveTextContent('axelle@example.fr');
    expect(mockApiGet).toHaveBeenCalledTimes(2);
    expect(mockApiGet).toHaveBeenNthCalledWith(1, '/users/profile', { skipTokenRefresh: true });
    expect(mockApiGet).toHaveBeenNthCalledWith(2, '/users/profile', { skipTokenRefresh: true });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith('/auth/refresh', {}, undefined);
  });

  it('stays signed out when /profile returns 403 and the refresh fails', async () => {
    mockApiGet.mockRejectedValueOnce(buildHttpError(403, 'Forbidden'));
    mockApiPost.mockResolvedValueOnce({ success: false });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user-email')).toBeEmptyDOMElement();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });
});

describe('AuthContext session expiry', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiPatch.mockReset();
    mockApiDelete.mockReset();
    mockSetSessionExpiredHandler.mockClear();
    mockSetSessionRefreshedHandler.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the user and shows a clear message when the session terminally expires', async () => {
    mockApiGet.mockResolvedValueOnce({ id: 1, email: 'axelle@example.fr' });
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('axelle@example.fr');
    });

    const expireSession = latestRegisteredHandler(mockSetSessionExpiredHandler);
    expect(typeof expireSession).toBe('function');

    act(() => {
      expireSession();
    });

    expect(screen.getByTestId('user-email')).toBeEmptyDOMElement();
    expect(screen.getByTestId('global-error')).toHaveTextContent(
      'Your session has expired. Please sign in again.',
    );
  });

  it('warns before the session expires, then clears the warning once renewed', async () => {
    vi.useFakeTimers();
    mockApiGet.mockResolvedValueOnce({ id: 1, email: 'axelle@example.fr' });
    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('user-email')).toHaveTextContent('axelle@example.fr');
    expect(screen.getByTestId('session-expiring-soon')).toHaveTextContent('false');

    // Just short of the 7-day session window (minus the 10-minute warning
    // buffer): still not warning yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000 - 11 * 60 * 1000);
    });
    expect(screen.getByTestId('session-expiring-soon')).toHaveTextContent('false');

    // Past the warning buffer: now it should warn.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    });
    expect(screen.getByTestId('session-expiring-soon')).toHaveTextContent('true');

    // The reactive silent-refresh handler (called by services/api.js) renews
    // the estimate and clears the warning, same as an explicit refresh would.
    const markRefreshed = latestRegisteredHandler(mockSetSessionRefreshedHandler);
    expect(typeof markRefreshed).toBe('function');
    act(() => {
      markRefreshed();
    });
    expect(screen.getByTestId('session-expiring-soon')).toHaveTextContent('false');
  });
});

// The demo account is also blocked server-side (authenticateToken.js rejects
// every mutating request before it reaches the database) — these guards are
// a second, independent layer: account-mutating actions never even attempt
// the API call for a hydrated demo user, so there's no round trip to a 403
// and no chance of a raw/generic error reaching the Profile page.
describe('AuthContext demo account guards', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiPatch.mockReset();
    mockApiDelete.mockReset();
  });

  const renderAsDemo = async () => {
    mockApiGet.mockResolvedValueOnce({ id: 44, email: 'demo@frameset.app', isDemo: true });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    return result;
  };

  it('updateUserProfile refuses locally, without calling the API', async () => {
    const result = await renderAsDemo();

    let outcome;
    await act(async () => {
      outcome = await result.current.updateUserProfile({ name: 'New Name', email: 'x@y.com' });
    });

    expect(outcome).toEqual({ success: false, message: 'Not available in the demo account.' });
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('changePassword refuses locally, without calling the API', async () => {
    const result = await renderAsDemo();

    let outcome;
    await act(async () => {
      outcome = await result.current.changePassword({
        currentPassword: 'whatever',
        newPassword: 'NewPass123',
      });
    });

    expect(outcome).toEqual({ success: false, message: 'Not available in the demo account.' });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('deleteAccount refuses locally, without calling the API', async () => {
    const result = await renderAsDemo();

    let outcome;
    await act(async () => {
      outcome = await result.current.deleteAccount({ currentPassword: 'whatever' });
    });

    expect(outcome).toEqual({ success: false, message: 'Not available in the demo account.' });
    expect(mockApiDelete).not.toHaveBeenCalled();
  });
});

// Business (4xx) failures must come back inline ({ success: false, message })
// so pages can show them next to the form; 5xx go to the global banner and
// leave `message` unset. Same contract for every action.
describe('AuthContext action error paths', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDelete.mockReset();
  });

  const buildBusinessError = (status, message, extra = {}) => {
    const error = new Error(message);
    error.status = status;
    error.data = { error: message, ...extra.data };
    if (extra.retryAfterSeconds !== undefined) error.retryAfterSeconds = extra.retryAfterSeconds;
    return error;
  };

  const renderSignedOut = async () => {
    mockApiGet.mockRejectedValueOnce(buildBusinessError(401, 'Missing token.'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    return result;
  };

  const renderSignedIn = async () => {
    mockApiGet.mockResolvedValueOnce({ id: 7, name: 'Jane', email: 'jane@example.com' });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    return result;
  };

  it('login surfaces the message, the stable error code and the retry delay', async () => {
    const result = await renderSignedOut();
    mockApiPost.mockRejectedValueOnce(
      buildBusinessError(401, 'Please verify your email before signing in.', {
        data: { code: 'EMAIL_NOT_VERIFIED' },
        retryAfterSeconds: 30,
      }),
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.login('jane@example.com', 'BadPass1');
    });

    expect(outcome).toEqual({
      success: false,
      message: 'Please verify your email before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
      retryAfterSeconds: 30,
    });
    expect(result.current.user).toBeNull();
  });

  it('verify/resend/forgot/reset all return the business message inline', async () => {
    const result = await renderSignedOut();

    const actions = [
      ['verifyEmail', () => result.current.verifyEmail('jane@example.com', '123456')],
      ['resendVerificationCode', () => result.current.resendVerificationCode('jane@example.com')],
      ['requestPasswordReset', () => result.current.requestPasswordReset('jane@example.com')],
      [
        'resetPassword',
        () => result.current.resetPassword('jane@example.com', '123456', 'NewPass123'),
      ],
    ];

    for (const [name, run] of actions) {
      mockApiPost.mockRejectedValueOnce(buildBusinessError(400, `${name} went wrong.`));
      let outcome;
      await act(async () => {
        outcome = await run();
      });
      expect(outcome).toEqual({
        success: false,
        message: `${name} went wrong.`,
        retryAfterSeconds: undefined,
      });
    }
  });

  it('updateUserProfile keeps the current user and returns the message on a 4xx', async () => {
    const result = await renderSignedIn();
    mockApiPut.mockRejectedValueOnce(buildBusinessError(400, 'This email is already in use.'));

    let outcome;
    await act(async () => {
      outcome = await result.current.updateUserProfile({
        name: 'Jane',
        email: 'taken@example.com',
      });
    });

    expect(outcome).toEqual({
      success: false,
      message: 'This email is already in use.',
      retryAfterSeconds: undefined,
    });
    expect(result.current.user.email).toBe('jane@example.com');
  });

  it('changePassword leaves message unset on a 5xx (the global banner owns it)', async () => {
    const result = await renderSignedIn();
    const serverError = new Error('Internal server error.');
    serverError.status = 500;
    mockApiPost.mockRejectedValueOnce(serverError);

    let outcome;
    await act(async () => {
      outcome = await result.current.changePassword({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });
    });

    expect(outcome.success).toBe(false);
    expect(outcome.message).toBeUndefined();
  });

  it('logout clears the user locally even when the server revocation fails', async () => {
    const result = await renderSignedIn();
    mockApiPost.mockRejectedValueOnce(new Error('network down'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });
});

describe('AuthContext two-factor authentication', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
  });

  const renderSignedOut = async () => {
    const notFoundError = new Error('Missing token.');
    notFoundError.status = 401;
    mockApiGet.mockRejectedValueOnce(notFoundError);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    return result;
  };

  const renderSignedIn = async (overrides = {}) => {
    mockApiGet.mockResolvedValueOnce({
      id: 7,
      name: 'Jane',
      email: 'jane@example.com',
      totpEnabled: false,
      ...overrides,
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    return result;
  };

  it('login defers the session and returns the challenge token when 2FA is enabled', async () => {
    const result = await renderSignedOut();
    mockApiPost.mockResolvedValueOnce({
      success: true,
      requiresTotp: true,
      challengeToken: 'tok-1',
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.login('jane@example.com', 'Pass1234');
    });

    expect(outcome).toEqual({ success: false, requiresTotp: true, challengeToken: 'tok-1' });
    expect(result.current.user).toBeNull();
  });

  it('loginWithGoogle defers the session behind the same challenge when 2FA is enabled', async () => {
    const result = await renderSignedOut();
    mockApiPost.mockResolvedValueOnce({
      success: true,
      requiresTotp: true,
      challengeToken: 'tok-g',
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.loginWithGoogle('google-id-token');
    });

    expect(outcome).toEqual({ success: false, requiresTotp: true, challengeToken: 'tok-g' });
    expect(result.current.user).toBeNull();
  });

  it('completeTotpLogin signs the user in on a correct code', async () => {
    const result = await renderSignedOut();
    mockApiPost.mockResolvedValueOnce({
      id: 7,
      name: 'Jane',
      email: 'jane@example.com',
      totpEnabled: true,
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.completeTotpLogin('tok-1', '123456');
    });

    expect(outcome.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/auth/login/totp',
      { challengeToken: 'tok-1', code: '123456' },
      expect.anything(),
    );
    expect(result.current.user).toEqual(
      expect.objectContaining({ id: 7, email: 'jane@example.com' }),
    );
  });

  it('completeTotpLogin surfaces an incorrect-code business error inline', async () => {
    const result = await renderSignedOut();
    const businessError = new Error('Incorrect code.');
    businessError.status = 401;
    businessError.data = { error: 'Incorrect code.' };
    mockApiPost.mockRejectedValueOnce(businessError);

    let outcome;
    await act(async () => {
      outcome = await result.current.completeTotpLogin('tok-1', '000000');
    });

    expect(outcome).toEqual({
      success: false,
      message: 'Incorrect code.',
      retryAfterSeconds: undefined,
    });
    expect(result.current.user).toBeNull();
  });

  it('setupTotp refuses locally for the demo account, without calling the API', async () => {
    const result = await renderSignedIn({ isDemo: true });

    let outcome;
    await act(async () => {
      outcome = await result.current.setupTotp();
    });

    expect(outcome).toEqual({ success: false, message: 'Not available in the demo account.' });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('setupTotp returns the secret and otpauth URL', async () => {
    const result = await renderSignedIn();
    mockApiPost.mockResolvedValueOnce({ secret: 'ABCD1234', otpauthUrl: 'otpauth://totp/x' });

    let outcome;
    await act(async () => {
      outcome = await result.current.setupTotp();
    });

    expect(outcome).toEqual({ success: true, secret: 'ABCD1234', otpauthUrl: 'otpauth://totp/x' });
    expect(mockApiPost).toHaveBeenCalledWith('/users/totp/setup', {}, expect.anything());
  });

  it('confirmTotpSetup marks 2FA enabled locally and returns the recovery codes', async () => {
    const result = await renderSignedIn();
    mockApiPost.mockResolvedValueOnce({ success: true, recoveryCodes: ['AAAAA-BBBBB'] });

    let outcome;
    await act(async () => {
      outcome = await result.current.confirmTotpSetup('123456');
    });

    expect(outcome).toEqual({ success: true, recoveryCodes: ['AAAAA-BBBBB'] });
    expect(result.current.user.totpEnabled).toBe(true);
    // The fresh set is all unused — the profile's remaining-codes hint starts full.
    expect(result.current.user.recoveryCodesRemaining).toBe(1);
  });

  it('confirmTotpSetup leaves 2FA off locally on an incorrect code', async () => {
    const result = await renderSignedIn();
    const businessError = new Error('Incorrect code.');
    businessError.status = 400;
    businessError.data = { error: 'Incorrect code.' };
    mockApiPost.mockRejectedValueOnce(businessError);

    let outcome;
    await act(async () => {
      outcome = await result.current.confirmTotpSetup('000000');
    });

    expect(outcome).toEqual({
      success: false,
      message: 'Incorrect code.',
      retryAfterSeconds: undefined,
    });
    expect(result.current.user.totpEnabled).toBe(false);
  });

  it('disableTotp marks 2FA disabled locally after a successful re-auth', async () => {
    const result = await renderSignedIn({ totpEnabled: true, recoveryCodesRemaining: 5 });
    mockApiPost.mockResolvedValueOnce({ success: true });

    let outcome;
    await act(async () => {
      outcome = await result.current.disableTotp({ currentPassword: 'Pass1234' });
    });

    expect(outcome).toEqual({ success: true });
    expect(result.current.user.totpEnabled).toBe(false);
    expect(result.current.user.recoveryCodesRemaining).toBe(0);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/users/totp/disable',
      { currentPassword: 'Pass1234' },
      expect.anything(),
    );
  });

  it('regenerateRecoveryCodes returns the fresh set and updates the local count', async () => {
    const result = await renderSignedIn({ totpEnabled: true, recoveryCodesRemaining: 1 });
    mockApiPost.mockResolvedValueOnce({
      success: true,
      recoveryCodes: ['AAAAA-BBBBB', 'CCCCC-DDDDD'],
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.regenerateRecoveryCodes({ currentPassword: 'Pass1234' });
    });

    expect(outcome).toEqual({ success: true, recoveryCodes: ['AAAAA-BBBBB', 'CCCCC-DDDDD'] });
    expect(mockApiPost).toHaveBeenCalledWith(
      '/users/totp/recovery-codes',
      { currentPassword: 'Pass1234' },
      expect.anything(),
    );
    expect(result.current.user.recoveryCodesRemaining).toBe(2);
  });

  it('regenerateRecoveryCodes propagates a failed re-auth without touching the count', async () => {
    const result = await renderSignedIn({ totpEnabled: true, recoveryCodesRemaining: 1 });
    const businessError = new Error('Current password is incorrect.');
    businessError.status = 401;
    businessError.data = { error: 'Current password is incorrect.' };
    mockApiPost.mockRejectedValueOnce(businessError);

    let outcome;
    await act(async () => {
      outcome = await result.current.regenerateRecoveryCodes({ currentPassword: 'wrong' });
    });

    expect(outcome).toEqual({
      success: false,
      message: 'Current password is incorrect.',
      retryAfterSeconds: undefined,
    });
    expect(result.current.user.recoveryCodesRemaining).toBe(1);
  });

  it('disableTotp propagates a failed re-authentication without changing local state', async () => {
    const result = await renderSignedIn({ totpEnabled: true });
    const businessError = new Error('Current password is incorrect.');
    businessError.status = 401;
    businessError.data = { error: 'Current password is incorrect.' };
    mockApiPost.mockRejectedValueOnce(businessError);

    let outcome;
    await act(async () => {
      outcome = await result.current.disableTotp({ currentPassword: 'wrong' });
    });

    expect(outcome).toEqual({
      success: false,
      message: 'Current password is incorrect.',
      retryAfterSeconds: undefined,
    });
    expect(result.current.user.totpEnabled).toBe(true);
  });
});
