import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

const { mockApiGet, mockApiPost, mockApiPut, mockApiPatch, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn()
}));

vi.mock('../../src/services/api', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    patch: mockApiPatch,
    delete: mockApiDelete
  }
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const AuthProbe = () => {
  const { user, authLoading } = useAuth();

  return (
    <div>
      <p data-testid="auth-loading">{String(authLoading)}</p>
      <p data-testid="user-email">{user?.email || ''}</p>
    </div>
  );
};

const renderProvider = () => {
  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
};

const buildHttpError = (status, message = 'Erreur HTTP') => {
  const error = new Error(message);
  error.status = status;
  return error;
};

describe('Hydratation de session AuthContext', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiPatch.mockReset();
    mockApiDelete.mockReset();
  });

  it("hydrate l'utilisateur si /profile retourne 200", async () => {
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

  it("reste déconnecté si /profile retourne 401", async () => {
    mockApiGet.mockRejectedValueOnce(buildHttpError(401, 'Non autorisé'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user-email')).toBeEmptyDOMElement();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("tente un refresh si /profile retourne 403 et hydrate l'utilisateur si succès", async () => {
    mockApiGet
      .mockRejectedValueOnce(buildHttpError(403, 'Interdit'))
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

  it("reste déconnecté si /profile retourne 403 et que le refresh échoue", async () => {
    mockApiGet.mockRejectedValueOnce(buildHttpError(403, 'Interdit'));
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