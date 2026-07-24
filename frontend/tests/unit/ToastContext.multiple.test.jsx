import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/context/ToastContext';

function Harness() {
  const { showToast } = useToast();
  return (
    <div>
      <button type="button" onClick={() => showToast('First', 'success', 1000)}>
        first
      </button>
      <button type="button" onClick={() => showToast('Second', 'danger', 3000)}>
        second
      </button>
      <button type="button" onClick={() => showToast('Third', 'info', 5000)}>
        third
      </button>
    </div>
  );
}

describe('ToastContext with multiple simultaneous toasts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stacks several toasts fired back to back, each visible at once', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('first'));
    fireEvent.click(screen.getByText('second'));
    fireEvent.click(screen.getByText('third'));

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('dismisses each toast on its own timer, independently of the others', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('first')); // 1000ms
    fireEvent.click(screen.getByText('second')); // 3000ms
    fireEvent.click(screen.getByText('third')); // 5000ms

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText('Third')).not.toBeInTheDocument();
  });

  it('manually closing one toast leaves the others untouched (their timers keep running)', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('first'));
    fireEvent.click(screen.getByText('second'));
    fireEvent.click(screen.getByText('third'));

    const [, closeSecond] = screen.getAllByRole('button', { name: /close notification/i });
    fireEvent.click(closeSecond);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();

    // The dismissed toast's timer was cleared too — advancing past its
    // original 3000ms duration must not throw or double-dismiss anything.
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('shows duplicate calls with the same message as separate, independently dismissible toasts', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('first'));
    fireEvent.click(screen.getByText('first'));

    expect(screen.getAllByText('First')).toHaveLength(2);
    const [closeFirst] = screen.getAllByRole('button', { name: /close notification/i });
    fireEvent.click(closeFirst);
    expect(screen.getAllByText('First')).toHaveLength(1);
  });

  it('gives a danger toast role="alert" and others role="status" even when stacked together', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('first')); // success -> status
    fireEvent.click(screen.getByText('second')); // danger -> alert

    expect(screen.getByRole('alert')).toHaveTextContent('Second');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
