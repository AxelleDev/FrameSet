import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/context/ToastContext';

function Harness({ message = 'Saved!', variant }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message, variant)}>
      go
    </button>
  );
}

describe('ToastContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast then removes it via the close button', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close notification/i }));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the default duration', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('uses role="status" for a success toast and role="alert" for danger', () => {
    render(
      <ToastProvider>
        <Harness message="Oops" variant="danger" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('alert')).toHaveTextContent('Oops');
  });

  it('degrades to a no-op outside a provider (never crashes)', () => {
    // useToast falls back to no-ops, so rendering without a provider is safe.
    expect(() => render(<Harness />)).not.toThrow();
    expect(() => fireEvent.click(screen.getByText('go'))).not.toThrow();
  });
});
