// Card's keyboard-button affordances and Modal's close/focus contracts —
// the two primitives every surface and dialog in the app sit on.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Card from '../../src/components/Card';
import Modal from '../../src/components/Modal';

describe('Card', () => {
  it('renders a plain surface without button semantics when not clickable', () => {
    render(<Card>content</Card>);
    const el = screen.getByText('content');
    expect(el).not.toHaveAttribute('role');
    expect(el).not.toHaveAttribute('tabindex');
  });

  it('becomes a keyboard-operable button when it carries an onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick}>
        open me
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'open me' });

    card.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('respects an explicit role instead of forcing button semantics', () => {
    render(
      <Card onClick={() => {}} role="listitem">
        row
      </Card>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>secret</p>
      </Modal>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Dialog">
        <p>body</p>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the header close button when shown', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Dialog" showClose>
        <p>body</p>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes dialog semantics with the title as accessible name', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Save your codes">
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Save your codes' })).toBeInTheDocument();
  });

  it('restores focus to the opener when it closes', async () => {
    const Wrapper = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Dialog">
            <p>body</p>
          </Modal>
        </>
      );
    };
    const user = userEvent.setup();
    render(<Wrapper />);

    const opener = screen.getByRole('button', { name: 'opener' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});

describe('Modal focus trap', () => {
  it('wraps Tab from the last focusable back to the first, and Shift+Tab the other way', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={() => {}} title="Trap" showClose={false}>
        <button type="button">first</button>
        <button type="button">last</button>
      </Modal>,
    );
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });

    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    first.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });
});
