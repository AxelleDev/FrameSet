import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../src/components/Modal';

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        Content
      </Modal>,
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders the content, the title and the dialog role when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="My title">
        Content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('closes with the Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        X
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the Close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} showClose>
        X
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
