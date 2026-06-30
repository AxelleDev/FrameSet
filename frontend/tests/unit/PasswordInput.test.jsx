import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../../src/components/PasswordInput';

describe('PasswordInput', () => {
  it('masque la valeur par défaut et bascule en clair au clic', async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="" onChange={() => {}} placeholder="Mot de passe" />);

    const input = screen.getByPlaceholderText('Mot de passe');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /afficher le mot de passe/i }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /masquer le mot de passe/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('peut être désactivé (champ + bouton)', () => {
    render(<PasswordInput value="" onChange={() => {}} placeholder="pw" disabled />);
    expect(screen.getByPlaceholderText('pw')).toBeDisabled();
    expect(screen.getByRole('button', { name: /afficher le mot de passe/i })).toBeDisabled();
  });
});
