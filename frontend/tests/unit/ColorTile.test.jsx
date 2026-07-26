import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorTile from '../../src/components/ColorTile';

describe('ColorTile copy-formats menu', () => {
  it('keeps the caption as plain text when no onCopyValue is provided', () => {
    render(<ColorTile hex="#FF0000" name="Reflet" />);
    expect(screen.getByText('#FF0000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy #FF0000 in another format/i })).toBeNull();
  });

  it('opens a menu listing HEX, RGB, HSL and HSB and copies the picked format', async () => {
    const user = userEvent.setup();
    const onCopyValue = vi.fn();
    render(<ColorTile hex="#FF0000" name="Reflet" onCopyValue={onCopyValue} />);

    const trigger = screen.getByRole('button', { name: /copy #FF0000 in another format/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(menu).toHaveTextContent('rgb(255, 0, 0)');

    await user.click(screen.getByRole('menuitem', { name: /rgb/i }));
    expect(onCopyValue).toHaveBeenCalledWith('rgb(255, 0, 0)');
    // The menu stays open briefly so the "Copied!" confirmation is visible,
    // instead of vanishing instantly (which read as "nothing happened").
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('auto-closes the menu shortly after a format is picked', () => {
    vi.useFakeTimers();
    try {
      render(<ColorTile hex="#FF0000" name="Reflet" onCopyValue={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /copy #FF0000 in another format/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /rgb/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ColorTile hex="#FF0000" name="Reflet" onCopyValue={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /copy #FF0000 in another format/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('shows a transient "Copied" state on the row whose value was just copied', async () => {
    const user = userEvent.setup();
    render(
      <ColorTile hex="#FF0000" name="Reflet" onCopyValue={vi.fn()} copiedValue="rgb(255, 0, 0)" />,
    );

    await user.click(screen.getByRole('button', { name: /copy #FF0000 in another format/i }));
    expect(screen.getByRole('menuitem', { name: /rgb/i })).toHaveTextContent(/copied/i);
  });
});
