import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../../src/pages/NotFound';

const renderPage = () => {
  render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  );
};

describe('NotFound', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirige vers la page de connexion quand aucun utilisateur n\'est connecté', () => {
    renderPage();

    const link = screen.getByRole('link', { name: /retour à l'accueil/i });
    expect(link.getAttribute('href')).toContain('/login');
  });

  it('redirige vers le tableau de bord quand un token utilisateur est présent', () => {
    localStorage.setItem('frameset_user', JSON.stringify({ token: 'demo-token' }));
    renderPage();

    const link = screen.getByRole('link', { name: /retour à l'accueil/i });
    expect(link.getAttribute('href')).toContain('/app/dashboard');
  });
});
