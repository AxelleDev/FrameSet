import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary, { FALLBACK_MESSAGE } from '../../src/components/ErrorBoundary';

function CrashOnRender() {
  throw new Error('forced render crash');
}

describe('ErrorBoundary', () => {
  it('shows the fallback when a child component crashes during render', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <CrashOnRender />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(FALLBACK_MESSAGE);

    consoleErrorSpy.mockRestore();
  });
});