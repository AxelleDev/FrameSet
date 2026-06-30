import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../src/components/Modal';

describe('Modal', () => {
  it('ne rend rien quand isOpen est false', () => {
    render(<Modal isOpen={false} onClose={() => {}}>Contenu</Modal>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('rend le contenu, le titre et le rôle dialog quand ouvert', () => {
    render(<Modal isOpen onClose={() => {}} title="Mon titre">Contenu</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Mon titre')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('ferme avec la touche Échap', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose}>X</Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ferme via le bouton Fermer', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} showClose>X</Modal>);
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
