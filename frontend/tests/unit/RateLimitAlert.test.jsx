import React from 'react';
import { render, screen, act } from '@testing-library/react';
import RateLimitAlert from '../../src/components/RateLimitAlert';

describe('RateLimitAlert', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing without a message', () => {
    const { container } = render(<RateLimitAlert message="" retryAfterSeconds={30} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to the static message when there is no retryAfterSeconds', () => {
    render(<RateLimitAlert message="Too many attempts, please try again in a minute." />);
    expect(
      screen.getByText('Too many attempts, please try again in a minute.'),
    ).toBeInTheDocument();
  });

  it('replaces the static duration with a live countdown that ticks down', async () => {
    vi.useFakeTimers();
    render(
      <RateLimitAlert
        message="Too many verification attempts, try again in 10 minutes."
        retryAfterSeconds={65}
      />,
    );
    expect(
      screen.getByText('Too many verification attempts. Try again in 1:05.'),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(
      screen.getByText('Too many verification attempts. Try again in 1:00.'),
    ).toBeInTheDocument();
  });

  it('switches to "try again now" once the countdown reaches 0', async () => {
    vi.useFakeTimers();
    render(
      <RateLimitAlert
        message="Too many attempts, try again in 10 minutes."
        retryAfterSeconds={1}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('Too many attempts. You can try again now.')).toBeInTheDocument();
  });
});
