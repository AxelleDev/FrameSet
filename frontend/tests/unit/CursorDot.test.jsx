import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CursorDot from '../../src/components/CursorDot';

const mediaQueryList = (matches) => ({
  matches,
  addEventListener: () => {},
  removeEventListener: () => {},
});

describe('CursorDot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is decorative: hidden from assistive tech and click-through', () => {
    render(<CursorDot />);
    const dot = screen.getByTestId('cursor-dot');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot.className).toContain('pointer-events-none');
  });

  it('appears at the pointer position on the first mouse movement', () => {
    // Fine pointer, no reduced-motion preference.
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      mediaQueryList(query === '(pointer: fine)'),
    );
    render(<CursorDot />);
    const dot = screen.getByTestId('cursor-dot');
    expect(dot.style.opacity).not.toBe('1');

    fireEvent.mouseMove(window, { clientX: 120, clientY: 80 });
    expect(dot.style.opacity).toBe('1');
  });

  it('stays inert for touch pointers and for reduced-motion users', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => mediaQueryList(false));
    render(<CursorDot />);
    const dot = screen.getByTestId('cursor-dot');

    fireEvent.mouseMove(window, { clientX: 120, clientY: 80 });
    expect(dot.style.opacity).not.toBe('1');
  });

  it('registers the click squish without breaking visibility', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      mediaQueryList(query === '(pointer: fine)'),
    );
    render(<CursorDot />);
    const dot = screen.getByTestId('cursor-dot');

    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseDown(window);
    fireEvent.mouseUp(window);
    expect(dot.style.opacity).toBe('1');
  });

  it('hides when the pointer leaves the window', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      mediaQueryList(query === '(pointer: fine)'),
    );
    render(<CursorDot />);
    const dot = screen.getByTestId('cursor-dot');

    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    expect(dot.style.opacity).toBe('1');

    fireEvent.mouseLeave(document.documentElement);
    expect(dot.style.opacity).toBe('0');
  });
});
