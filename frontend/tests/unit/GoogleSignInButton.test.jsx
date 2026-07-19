import React from 'react';
import { render, waitFor } from '@testing-library/react';
import GoogleSignInButton from '../../src/components/GoogleSignInButton';

describe('GoogleSignInButton', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing when no client id is configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { container } = render(<GoogleSignInButton onCredential={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('initializes GIS with the client id and forwards the credential', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    const initialize = vi.fn();
    const renderButton = vi.fn();
    // Pretend the GIS script is already loaded so no network fetch happens.
    vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } });

    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id' }),
    );

    // Simulate Google invoking the sign-in callback with an ID token.
    const { callback } = initialize.mock.calls[0][0];
    callback({ credential: 'google-id-token' });
    expect(onCredential).toHaveBeenCalledWith('google-id-token');

    // A response without a credential (dismissed prompt) must not fire the handler.
    callback({});
    expect(onCredential).toHaveBeenCalledTimes(1);
  });
});
