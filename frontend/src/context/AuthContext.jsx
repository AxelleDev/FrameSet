/**
 * Auth context: mirrors the user session (which lives in backend HttpOnly
 * cookies) and exposes the auth actions via useAuth(). Also drives globalError.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setSessionExpiredHandler } from '../services/api';
import logger from '../utils/logger';
import { handleApiError } from '../utils/apiError';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Authenticated user (null when logged out). authLoading is true until the
  // initial session hydration completes, so guards can avoid flashing.
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  // Requests a new access token via the refresh cookie. silent suppresses the
  // global error banner (used during hydration). Returns whether a token issued.
  const refreshAccessToken = useCallback(async ({ silent = false } = {}) => {
    try {
      // Silent refresh (during hydration) must not flash a global error.
      const refreshOptions = silent ? undefined : { onGlobalError: setGlobalError };
      const data = await api.post('/auth/refresh', {}, refreshOptions);
      return Boolean(data?.success);
    } catch (error) {
      logger.error('auth.refreshAccessToken.error', error);
      return false;
    }
  }, [setGlobalError]);

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
  }, [refreshAccessToken]);

  // Clear the session when the API reports a terminal auth failure (a 403 that a
  // token refresh could not recover). Route guards then redirect to /login.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  /** Replaces the current user (clears it when given a falsy value). */
  const setAuthenticatedUser = useCallback((userData) => {
    if (!userData) {
      setUser(null);
      return;
    }

    setUser(userData);
  }, []);

  /** Shallow-merges partial fields into the current user (e.g. after an update). */
  const applyUserUpdate = useCallback((userData) => {
    if (!userData) return;

    setUser((currentUser) => {
      return {
        ...(currentUser || {}),
        ...userData
      };
    });
  }, []);

  // Authenticates with email/password and stores the returned user.
  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Something went wrong.');
      return { success: false, message };
    }
  }, [setAuthenticatedUser]);

  // Registers a new account without logging in; caller redirects to verification.
  const register = useCallback(async (userData) => {
    try {
      const registrationData = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      return { success: true, data: registrationData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Something went wrong.');
      return { success: false, message };
    }
  }, [setGlobalError]);

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
    }
  }, []);

  // Updates name/email. A changed email becomes a pendingEmail that must be
  // confirmed via the verification flow before it takes effect.
  const updateUserProfile = useCallback(async (updates) => {
    if (!user) return;

    try {
      const data = await api.put('/users', { id: user.id, ...updates }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        name: data.name ?? user.name,
        email: data.email ?? user.email,
        pendingEmail: data.pendingEmail ?? user.pendingEmail
      };
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      logger.error('auth.updateUserProfile.error', error);
      // Business errors (4xx) are returned for an inline toast; server errors
      // (5xx) already surfaced on the global banner via onGlobalError.
      const isBusinessError = error.status && error.status < 500;
      return { success: false, message: isBusinessError ? (error.data?.error || error.message) : undefined };
    }
  }, [user]);

  // Permanently deletes the account and logs the user out locally on success.
  const deleteAccount = useCallback(async () => {
    try {
      await api.delete('/users/me', null, { onGlobalError: setGlobalError });
      setUser(null);
      setGlobalError(null);
      return { success: true };
    } catch (error) {
      const { message } = handleApiError(error, setGlobalError, 'Failed to delete the account.');
      return { success: false, message };
    }
  }, []);

  // Changes the password after verifying the current one; records the
  // passwordUpdatedAt timestamp on success. `message` is set only for 4xx
  // (business) errors, shown inline in the form.
  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    if (!user) {
      return { success: false, message: 'Utilisateur non connecte.' };
    }

    try {
      const data = await api.post('/users/password', { id: user.id, currentPassword, newPassword }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        passwordUpdatedAt: data.passwordUpdatedAt || new Date().toISOString()
      };
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      logger.error('auth.changePassword.error', error);
      // Surface 4xx messages inline; leave message undefined for server errors
      // (those already went to the global banner via onGlobalError).
      const isBusinessError = error.status && error.status < 500;
      return { success: false, message: isBusinessError ? (error.data?.error || error.message) : undefined };
    }
  }, [user]);

  // Confirms a new account's email with the code emailed at signup.
  const verifyEmail = useCallback(async (email, code) => {
    try {
      const data = await api.post('/auth/verify', { email, code }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Code incorrect.');
      return { success: false, message };
    }
  }, [setGlobalError]);

  /** Re-sends the account email-verification code. */
  const resendVerificationCode = useCallback(async (email) => {
    try {
      const data = await api.post('/auth/resend-code', { email }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, "Failed to send the code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

  // Starts the forgot-password flow (backend emails a reset code). The backend
  // responds identically whether or not the email exists (avoids user enumeration).
  const requestPasswordReset = useCallback(async (email) => {
    try {
      const data = await api.post('/auth/forgot-password', { email }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, "Failed to send the code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

  // Completes the forgot-password flow: submits the reset code and new password.
  const resetPassword = useCallback(async (email, code, newPassword) => {
    try {
      const data = await api.post('/auth/reset-password', { email, code, newPassword }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Password reset failed.');
      return { success: false, message };
    }
  }, [setGlobalError]);

  // Confirms a pending email change with its code and merges the updated user.
  const verifyPendingEmail = useCallback(async (email, code) => {
    try {
      const data = await api.post('/users/email/verify', { email, code }, { onGlobalError: setGlobalError });
      // Server returns the updated user (email now applied); merge it locally.
      if (data?.success && data.user) {
        applyUserUpdate(data.user);
      }
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Code incorrect.');
      return { success: false, message };
    }
  }, [applyUserUpdate, setGlobalError]);

  /** Re-sends the verification code for a pending email change. */
  const resendPendingEmailCode = useCallback(async (email) => {
    try {
      const data = await api.post('/users/email/resend', { email }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, "Failed to send the code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

  // Memoized context value so consumers only re-render when state/actions change.
  const value = useMemo(() => ({
    user,
    authLoading,
    globalError,
    setGlobalError,
    login,
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
    resendPendingEmailCode
  }), [
    user,
    authLoading,
    globalError,
    login,
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
    resendPendingEmailCode
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Accessor hook for the auth context. Throws if used outside an AuthProvider.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
