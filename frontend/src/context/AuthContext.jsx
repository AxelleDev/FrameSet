/**
 * Authentication context provider.
 *
 * Owns the current user session and exposes auth-related actions to the app.
 * The session itself lives in HttpOnly cookies managed by the backend; this
 * provider mirrors the resulting user object and orchestrates login, logout,
 * registration, email verification, profile/password updates and account
 * deletion. It also drives a global error banner via globalError/setGlobalError.
 *
 * Exposed via useAuth():
 *   State:   user, authLoading, globalError
 *   Setters: setGlobalError
 *   Actions: login, register, logout, refreshAccessToken, applyUserUpdate,
 *            updateUserProfile, changePassword, deleteAccount, verifyEmail,
 *            resendVerificationCode, verifyPendingEmail, resendPendingEmailCode
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import logger from '../utils/logger';
import { handleApiError } from '../utils/apiError';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Authenticated user (null when logged out). authLoading is true until the
  // initial session hydration completes, so guards can avoid flashing.
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  /**
   * Requests a new access token using the refresh-token cookie.
   * @param {{ silent?: boolean }} [opts] When silent, suppress the global error banner.
   * @returns {Promise<boolean>} Whether a new token was issued.
   */
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

  /**
   * Authenticates with email/password and stores the returned user.
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Une erreur est survenue.');
      return { success: false, message };
    }
  }, [setAuthenticatedUser]);

  /**
   * Registers a new account. Does not log the user in; the caller redirects to
   * email verification.
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  const register = useCallback(async (userData) => {
    try {
      const registrationData = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      return { success: true, data: registrationData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Une erreur est survenue.');
      return { success: false, message };
    }
  }, [setGlobalError]);

  /**
   * Logs out and clears local auth state. The local user is cleared even if the
   * server-side revocation request fails, so the UI always ends up logged out.
   */
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

  /**
   * Updates the user's name/email. A changed email becomes a `pendingEmail`
   * that must be confirmed via the verification flow before it takes effect.
   */
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la mise a jour du profil.');
      logger.error('auth.updateUserProfile.error', error);
    }
  }, [user]);

  /**
   * Permanently deletes the account and logs the user out locally on success.
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  const deleteAccount = useCallback(async () => {
    try {
      await api.delete('/users/me', null, { onGlobalError: setGlobalError });
      setUser(null);
      setGlobalError(null);
      return { success: true };
    } catch (error) {
      const { message } = handleApiError(error, setGlobalError, 'Erreur lors de la suppression du compte.');
      return { success: false, message };
    }
  }, []);

  /**
   * Changes the password after verifying the current one. On success, records
   * the server-reported (or local) passwordUpdatedAt timestamp on the user.
   * @returns {Promise<{success: boolean, message?: string}>}
   *   `message` is set only for business errors (4xx), shown inline in the form.
   */
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

  /**
   * Confirms a new account's email with the code emailed at signup.
   * @returns {Promise<{success: boolean, message?: string}>}
   */
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
      const { message } = handleApiError(err, setGlobalError, "Erreur lors de l'envoi du code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

  /**
   * Confirms a pending email change (initiated from the profile page) with its
   * code, and merges the updated user returned by the server.
   * @returns {Promise<{success: boolean, message?: string}>}
   */
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
      const { message } = handleApiError(err, setGlobalError, "Erreur lors de l'envoi du code.");
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
    verifyPendingEmail,
    resendPendingEmailCode
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Accessor hook for the auth context. Throws if used outside an AuthProvider.
 * @returns The auth context value (state + actions).
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit etre utilise dans un AuthProvider');
  }
  return context;
};
