import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalErrorAlert from '../../src/components/GlobalErrorAlert';

describe('GlobalErrorAlert', () => {
  it('affiche un message compréhensible pour une erreur réseau technique', () => {
    render(<GlobalErrorAlert message="Failed to fetch" />);

    expect(
      screen.getByText(/Impossible de contacter le serveur/i)
    ).toBeInTheDocument();
  });

  it('déclenche la fermeture quand on clique sur le bouton fermer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<GlobalErrorAlert message="Erreur test" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /fermer l'alerte/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
