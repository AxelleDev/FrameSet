import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary, { FALLBACK_MESSAGE } from '../../src/components/ErrorBoundary';

function CrashOnRender() {
  throw new Error('forced render crash');
}

describe('ErrorBoundary', () => {
  it('affiche le fallback quand un composant enfant plante au rendu', () => {
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