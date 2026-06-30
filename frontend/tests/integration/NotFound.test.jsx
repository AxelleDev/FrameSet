import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthContext } from '../../src/context/AuthContext';
import NotFound from '../../src/pages/NotFound';

const renderPage = (user = null) => {
  render(
    <HelmetProvider>
      <AuthContext.Provider value={{ user }}>
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>
      </AuthContext.Provider>
    </HelmetProvider>
  );
};

describe('NotFound', () => {
  it('redirige vers la page de connexion quand aucun utilisateur n\'est connecté', () => {
    renderPage();

    const link = screen.getByRole('link', { name: /retour à l'accueil/i });
    expect(link.getAttribute('href')).toContain('/login');
  });

  it('redirige vers le tableau de bord quand un utilisateur est connecté', () => {
    renderPage({ id: 1, email: 'axelle@example.com' });

    const link = screen.getByRole('link', { name: /retour à l'accueil/i });
    expect(link.getAttribute('href')).toContain('/app/dashboard');
  });
});
