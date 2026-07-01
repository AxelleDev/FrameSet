import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from '../../src/components/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('toggles the dark class on <html> and persists the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('frameset-theme')).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('frameset-theme')).toBe('light');
  });
});
