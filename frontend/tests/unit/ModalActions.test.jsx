import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalActions from '../../src/components/ModalActions';

describe('ModalActions', () => {
  it('rend un bouton secondaire "Annuler" par défaut + le primaire', () => {
    render(<ModalActions primaryLabel="Créer" onPrimary={() => {}} onSecondary={() => {}} />);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument();
  });

  it('déclenche onPrimary / onSecondary', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(<ModalActions primaryLabel="Créer" onPrimary={onPrimary} onSecondary={onSecondary} />);
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('désactive le primaire avec primaryDisabled', () => {
    render(<ModalActions primaryLabel="Créer" onPrimary={() => {}} onSecondary={() => {}} primaryDisabled />);
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();
  });
});
