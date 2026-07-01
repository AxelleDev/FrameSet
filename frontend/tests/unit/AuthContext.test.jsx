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
  },
  setSessionExpiredHandler: () => {}
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

const buildHttpError = (status, message = 'HTTP error') => {
  const error = new Error(message);
  error.status = status;
  return error;
};

describe('AuthContext session hydration', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiPatch.mockReset();
    mockApiDelete.mockReset();
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