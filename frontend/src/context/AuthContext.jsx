/**
 * Auth context: mirrors the user session (which lives in backend HttpOnly
 * cookies) and exposes the auth actions via useAuth(). Also drives globalError.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { setSessionExpiredHandler, setSessionRefreshedHandler } from '../services/api';
import logger from '../utils/logger';
import { handleApiError } from '../utils/apiError';
import { SESSION_MAX_AGE_MS } from '../constants/backendContract';

export const AuthContext = createContext(null);

// SESSION_MAX_AGE_MS mirrors the backend's refresh-token cookie lifetime:
// every successful refresh rotates the refresh token and slides this window
// forward, so an active user practically never hits it. It's the real
// "you'll be signed out" boundary — the access token (2h) refreshes silently
// and is never user-visible. Warn a bit ahead of it so an idle-but-open tab
// gets a chance to stay signed in before losing unsaved work.
const SESSION_WARNING_BEFORE_MS = 10 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

export const AuthProvider = ({ children }) => {
  // Authenticated user (null when logged out). authLoading is true until the
  // initial session hydration completes, so guards can avoid flashing.
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);
  // When the current session is estimated to expire (see SESSION_MAX_AGE_MS),
  // and whether we're within the warning window of that estimate.
  const sessionExpiresAtRef = useRef(null);
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);

  // Marks "now" as the start of a fresh SESSION_MAX_AGE_MS window: called after
  // every successful login/hydration/refresh (explicit or the reactive one
  // inside services/api.js), since each of those rotates the refresh token
  // server-side.
  const markSessionRefreshed = useCallback(() => {
    sessionExpiresAtRef.current = Date.now() + SESSION_MAX_AGE_MS;
    setSessionExpiringSoon(false);
  }, []);

  // Requests a new access token via the refresh cookie. silent suppresses the
  // global error banner (used during hydration). Returns whether a token issued.
  const refreshAccessToken = useCallback(
    async ({ silent = false } = {}) => {
      try {
        // Silent refresh (during hydration) must not flash a global error.
        const refreshOptions = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.post('/auth/refresh', {}, refreshOptions);
        const succeeded = Boolean(data?.success);
        if (succeeded) markSessionRefreshed();
        return succeeded;
      } catch (error) {
        logger.error('auth.refreshAccessToken.error', error);
        return false;
      }
    },
    [setGlobalError, markSessionRefreshed],
  );

  // On mount, restore the session from the auth cookies by fetching the profile.
  // Handles three cases: valid session, no session (401), and expired access
  // token (403 -> attempt one refresh, then retry the profile fetch once).
  useEffect(() => {
    let isMounted = true;

    const setHydratedUser = (nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      // A valid session was confirmed (with or without needing a refresh):
      // start the estimate fresh rather than assume the worst-case "already
      // near expiry", since we have no way to read the httpOnly cookie's exp.
      if (nextUser) markSessionRefreshed();
    };

    const hydrateSession = async () => {
      try {
        // skipTokenRefresh: we handle the 403/refresh flow explicitly below.
        const profile = await api.get('/users/profile', { skipTokenRefresh: true });
        setHydratedUser(profile || null);
        return;
      } catch (error) {
        // 401: no session at all -> remain logged out.
        if (error?.status === 401) {
          setHydratedUser(null);
          return;
        }

        // 403: access token expired -> try a silent refresh then refetch.
        if (error?.status === 403) {
          const refreshSucceeded = await refreshAccessToken({ silent: true });

          if (refreshSucceeded) {
            try {
              const profile = await api.get('/users/profile', { skipTokenRefresh: true });
              setHydratedUser(profile || null);
              return;
            } catch (profileRetryError) {
              if (profileRetryError?.status !== 401 && profileRetryError?.status !== 403) {
                logger.error('auth.hydration.profile_retry_failed', profileRetryError);
              }
            }
          }

          setHydratedUser(null);
          return;
        }

        logger.error('auth.hydration.profile_failed', error);
        setHydratedUser(null);
      } finally {
        // Hydration is done regardless of outcome; unblock route guards.
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [refreshAccessToken, markSessionRefreshed]);

  // Clear the session when the API reports a terminal auth failure (a 403 that a
  // token refresh could not recover). Route guards then redirect to /login. Also
  // surface a clear reason via the global-error toast, instead of a silent bounce
  // that leaves the user guessing why they landed back on the login page.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      sessionExpiresAtRef.current = null;
      setSessionExpiringSoon(false);
      setGlobalError('Your session has expired. Please sign in again.');
    });
    return () => setSessionExpiredHandler(null);
  }, [setGlobalError]);

  // Whenever the session is renewed anywhere (this provider's own refresh calls,
  // or the reactive silent refresh inside services/api.js triggered by a random
  // request hitting a 403), reset the "expires at" estimate the same way.
  useEffect(() => {
    setSessionRefreshedHandler(markSessionRefreshed);
    return () => setSessionRefreshedHandler(null);
  }, [markSessionRefreshed]);

  // Poll for the proactive "session expiring soon" warning while signed in, so
  // an idle-but-open tab gets a chance to stay signed in before losing unsaved
  // work, instead of being silently logged out once the estimate is exceeded.
  useEffect(() => {
    if (!user) return undefined;

    const checkExpiry = () => {
      if (!sessionExpiresAtRef.current) return;
      const isExpiringSoon = Date.now() >= sessionExpiresAtRef.current - SESSION_WARNING_BEFORE_MS;
      setSessionExpiringSoon(isExpiringSoon);
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  /** Replaces the current user (clears it when given a falsy value). */
  const setAuthenticatedUser = useCallback(
    (userData) => {
      if (!userData) {
        setUser(null);
        return;
      }

      setUser(userData);
      // Login/Google sign-in just (re)issued fresh auth cookies.
      markSessionRefreshed();
    },
    [markSessionRefreshed],
  );

  /** Shallow-merges partial fields into the current user (e.g. after an update). */
  const applyUserUpdate = useCallback((userData) => {
    if (!userData) return;

    setUser((currentUser) => {
      return {
        ...(currentUser || {}),
        ...userData,
      };
    });
  }, []);

  // Authenticates with email/password and stores the returned user.
  const login = useCallback(
    async (email, password) => {
      try {
        const userData = await api.post(
          '/auth/login',
          { email, password },
          { onGlobalError: setGlobalError },
        );
        setAuthenticatedUser(userData);
        return { success: true, data: userData };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Something went wrong.',
        );
        // Surface the server error code (e.g. EMAIL_NOT_VERIFIED) so callers branch on
        // a stable identifier instead of matching the human-readable message text.
        return { success: false, message, code: err?.data?.code, retryAfterSeconds };
      }
    },
    [setAuthenticatedUser],
  );

  // "Try without an account": logs into the shared, read-only demo account.
  // No credentials needed — the backend picks the single demo user.
  const loginAsDemo = useCallback(async () => {
    try {
      const userData = await api.post('/auth/demo-login', {}, { onGlobalError: setGlobalError });
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const { message, retryAfterSeconds } = handleApiError(
        err,
        setGlobalError,
        'The demo is not available right now.',
      );
      return { success: false, message, retryAfterSeconds };
    }
  }, [setAuthenticatedUser]);

  // Authenticates with a Google ID token (from the GIS button): the backend
  // verifies it, resolves/creates the account, and issues the session cookies.
  const loginWithGoogle = useCallback(
    async (credential) => {
      try {
        const userData = await api.post(
          '/auth/google',
          { credential },
          { onGlobalError: setGlobalError },
        );
        setAuthenticatedUser(userData);
        return { success: true, data: userData };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Google sign-in failed.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setAuthenticatedUser],
  );

  // Registers a new account without logging in; caller redirects to verification.
  const register = useCallback(
    async (userData) => {
      try {
        const registrationData = await api.post('/auth/register', userData, {
          onGlobalError: setGlobalError,
        });
        return { success: true, data: registrationData };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Something went wrong.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  // Logs out. Clears the local user even if server-side revocation fails, so the
  // UI always ends up logged out.
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { onGlobalError: setGlobalError });
    } catch (err) {
      logger.error('auth.logout.revoke_failed', err);
    } finally {
      setUser(null);
      setGlobalError(null);
      sessionExpiresAtRef.current = null;
      setSessionExpiringSoon(false);
    }
  }, []);

  // Updates name/email. A changed email becomes a pendingEmail that must be
  // confirmed via the verification flow before it takes effect. Changing the
  // email is a critical action: pass `credentials` ({ currentPassword } or
  // { googleCredential }) to re-authenticate.
  const updateUserProfile = useCallback(
    async (updates, credentials) => {
      if (!user) return;
      // Account-level changes are always blocked for the demo account (see
      // authenticateToken.js) — short-circuit here too so the UI never shows
      // a raw "something went wrong" for an action that was never going anywhere.
      if (user.isDemo) {
        return { success: false, message: 'Not available in the demo account.' };
      }

      try {
        const data = await api.put(
          '/users',
          { ...updates, ...(credentials || {}) },
          { onGlobalError: setGlobalError },
        );
        const updatedUser = {
          ...user,
          name: data.name ?? user.name,
          email: data.email ?? user.email,
          pendingEmail: data.pendingEmail ?? user.pendingEmail,
        };
        setUser(updatedUser);
        return { success: true };
      } catch (error) {
        logger.error('auth.updateUserProfile.error', error);
        // Business errors (4xx) are returned for an inline toast; server errors
        // (5xx) already surfaced on the global banner via onGlobalError.
        const isBusinessError = error.status && error.status < 500;
        return {
          success: false,
          message: isBusinessError ? error.data?.error || error.message : undefined,
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }
    },
    [user],
  );

  // Permanently deletes the account and logs the user out locally on success.
  // Destructive, so it requires re-authentication credentials
  // ({ currentPassword } or { googleCredential }).
  const deleteAccount = useCallback(
    async (credentials) => {
      if (user?.isDemo) {
        return { success: false, message: 'Not available in the demo account.' };
      }

      try {
        await api.delete('/users/me', credentials || null, { onGlobalError: setGlobalError });
        setUser(null);
        setGlobalError(null);
        return { success: true };
      } catch (error) {
        const { message, retryAfterSeconds } = handleApiError(
          error,
          setGlobalError,
          'Failed to delete the account.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [user],
  );

  // Changes the password after verifying the current one; records the
  // passwordUpdatedAt timestamp on success. `message` is set only for 4xx
  // (business) errors, shown inline in the form.
  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      if (!user) {
        return { success: false, message: 'You are not signed in.' };
      }
      if (user.isDemo) {
        return { success: false, message: 'Not available in the demo account.' };
      }

      try {
        const data = await api.post(
          '/users/password',
          { currentPassword, newPassword },
          { onGlobalError: setGlobalError },
        );
        const updatedUser = {
          ...user,
          passwordUpdatedAt: data.passwordUpdatedAt || new Date().toISOString(),
        };
        setUser(updatedUser);
        return { success: true };
      } catch (error) {
        logger.error('auth.changePassword.error', error);
        // Surface 4xx messages inline; leave message undefined for server errors
        // (those already went to the global banner via onGlobalError).
        const isBusinessError = error.status && error.status < 500;
        return {
          success: false,
          message: isBusinessError ? error.data?.error || error.message : undefined,
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }
    },
    [user],
  );

  // Confirms a new account's email with the code emailed at signup.
  const verifyEmail = useCallback(
    async (email, code) => {
      try {
        const data = await api.post(
          '/auth/verify',
          { email, code },
          { onGlobalError: setGlobalError },
        );
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Code incorrect.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  /** Re-sends the account email-verification code. */
  const resendVerificationCode = useCallback(
    async (email) => {
      try {
        const data = await api.post(
          '/auth/resend-code',
          { email },
          { onGlobalError: setGlobalError },
        );
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Failed to send the code.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  // Starts the forgot-password flow (backend emails a reset code). The backend
  // responds identically whether or not the email exists (avoids user enumeration).
  const requestPasswordReset = useCallback(
    async (email) => {
      try {
        const data = await api.post(
          '/auth/forgot-password',
          { email },
          { onGlobalError: setGlobalError },
        );
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Failed to send the code.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  // Completes the forgot-password flow: submits the reset code and new password.
  const resetPassword = useCallback(
    async (email, code, newPassword) => {
      try {
        const data = await api.post(
          '/auth/reset-password',
          { email, code, newPassword },
          { onGlobalError: setGlobalError },
        );
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Password reset failed.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  // Confirms a pending email change with its code and merges the updated user.
  const verifyPendingEmail = useCallback(
    async (email, code) => {
      try {
        const data = await api.post(
          '/users/email/verify',
          { email, code },
          { onGlobalError: setGlobalError },
        );
        // Server returns the updated user (email now applied); merge it locally.
        if (data?.success && data.user) {
          applyUserUpdate(data.user);
        }
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Code incorrect.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [applyUserUpdate, setGlobalError],
  );

  /** Re-sends the verification code for a pending email change. */
  const resendPendingEmailCode = useCallback(
    async (email) => {
      try {
        const data = await api.post(
          '/users/email/resend',
          { email },
          { onGlobalError: setGlobalError },
        );
        return { success: Boolean(data?.success) };
      } catch (err) {
        const { message, retryAfterSeconds } = handleApiError(
          err,
          setGlobalError,
          'Failed to send the code.',
        );
        return { success: false, message, retryAfterSeconds };
      }
    },
    [setGlobalError],
  );

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(
    () => ({
      user,
      authLoading,
      globalError,
      setGlobalError,
      sessionExpiringSoon,
      login,
      loginWithGoogle,
      loginAsDemo,
      register,
      logout,
      refreshAccessToken,
      applyUserUpdate,
      updateUserProfile,
      changePassword,
      deleteAccount,
      verifyEmail,
      resendVerificationCode,
      requestPasswordReset,
      resetPassword,
      verifyPendingEmail,
      resendPendingEmailCode,
    }),
    [
      user,
      authLoading,
      globalError,
      sessionExpiringSoon,
      login,
      loginWithGoogle,
      loginAsDemo,
      register,
      logout,
      refreshAccessToken,
      applyUserUpdate,
      updateUserProfile,
      changePassword,
      deleteAccount,
      verifyEmail,
      resendVerificationCode,
      requestPasswordReset,
      resetPassword,
      verifyPendingEmail,
      resendPendingEmailCode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Accessor hook for the auth context. Throws if used outside an AuthProvider.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
