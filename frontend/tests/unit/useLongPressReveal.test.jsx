import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import useLongPressReveal, { LONG_PRESS_MS } from '../../src/hooks/useLongPressReveal';

// Two cards driven by one page-level manager, like Dashboard/Palette/Norms use it.
function TwoCards({ onCardClick }) {
  const { getRevealProps } = useLongPressReveal();
  return (
    <div>
      <button type="button" data-testid="card-a" {...getRevealProps('a')} onClick={onCardClick} />
      <div data-testid="card-b" {...getRevealProps('b')} />
      <button type="button">outside</button>
    </div>
  );
}

const touch = (x = 10, y = 10) => ({ touches: [{ clientX: x, clientY: y }] });

describe('useLongPressReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals only after the full hold — never on a tap', () => {
    render(<TwoCards />);
    const card = screen.getByTestId('card-a');

    // Quick tap: press, release well before the threshold.
    fireEvent.touchStart(card, touch());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS / 2));
    fireEvent.touchEnd(card);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(card).not.toHaveAttribute('data-revealed');

    // Real hold: crosses the threshold.
    fireEvent.touchStart(card, touch());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(card).toHaveAttribute('data-revealed', 'true');
  });

  it('treats a moving finger as a scroll, not a hold', () => {
    render(<TwoCards />);
    const card = screen.getByTestId('card-a');

    fireEvent.touchStart(card, touch(10, 10));
    fireEvent.touchMove(card, touch(10, 40)); // beyond the drift tolerance
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(card).not.toHaveAttribute('data-revealed');
  });

  it('swallows the click that follows a completed hold', () => {
    const onCardClick = vi.fn();
    render(<TwoCards onCardClick={onCardClick} />);
    const card = screen.getByTestId('card-a');

    fireEvent.touchStart(card, touch());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.touchEnd(card);
    fireEvent.click(card); // the browser fires this on finger-lift
    expect(onCardClick).not.toHaveBeenCalled();

    // A later plain tap-click goes through normally.
    fireEvent.click(card);
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it('collapses on an outside touch, and only reveals one card at a time', () => {
    render(<TwoCards />);
    const cardA = screen.getByTestId('card-a');
    const cardB = screen.getByTestId('card-b');

    fireEvent.touchStart(cardA, touch());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(cardA).toHaveAttribute('data-revealed', 'true');

    // Holding the other card moves the reveal over to it.
    fireEvent.touchStart(cardB, touch());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(cardB).toHaveAttribute('data-revealed', 'true');
    expect(cardA).not.toHaveAttribute('data-revealed');

    // Touching outside anything revealed collapses it.
    fireEvent.touchStart(screen.getByRole('button', { name: 'outside' }), touch());
    expect(cardB).not.toHaveAttribute('data-revealed');
  });
});
