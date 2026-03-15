import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('active la confirmation seulement quand le mot attendu est saisi', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Supprimer mon compte"
        subtitle="Saisissez le mot demandé"
        message="Action irréversible"
        confirmLabel="Supprimer"
        onConfirm={onConfirm}
        onCancel={() => {}}
        confirmationWord="Suppression"
        confirmationInputLabel="Écrivez le mot de confirmation"
      />
    );

    const confirmButton = screen.getByRole('button', { name: 'Supprimer' });
    const input = screen.getByLabelText(/écrivez le mot de confirmation/i);

    expect(confirmButton).toBeDisabled();

    await user.type(input, 'suppression');
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Suppression');

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('laisse confirmer directement quand aucun mot de confirmation n’est requis', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Supprimer"
        message="Confirmer ?"
        confirmLabel="Confirmer"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeEnabled();
  });
});
