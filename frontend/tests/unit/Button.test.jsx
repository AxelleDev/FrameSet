import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Button from '../../src/components/Button';

describe('Button', () => {
  it('rend son contenu dans un <button> par défaut', () => {
    render(<Button>Continuer</Button>);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
  });

  it('appelle onClick au clic', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onClick quand il est désactivé", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Valider</Button>);
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("affiche l'état de chargement (aria-busy + désactivé)", () => {
    render(<Button loading>Envoyer</Button>);
    const btn = screen.getByRole('button', { name: 'Envoyer' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    ['primary', 'bg-blue'],
    ['danger', 'bg-danger'],
    ['ghost', 'bg-transparent'],
    ['outline', 'bg-blue/10'],
  ])('applique la variante %s', (variant, expectedClass) => {
    render(<Button variant={variant}>X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass(expectedClass);
  });

  it('rend un lien quand `to` est fourni', () => {
    render(
      <MemoryRouter>
        <Button to="/app/dashboard">Retour</Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Retour' });
    expect(link).toHaveAttribute('href', '/app/dashboard');
  });
});
