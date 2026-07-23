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
    </HelmetProvider>,
  );
};

describe('NotFound', () => {
  it('redirects to the sign-in page when no user is signed in', () => {
    renderPage();

    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link.getAttribute('href')).toContain('/login');
  });

  it('redirects to the dashboard when a user is signed in', () => {
    renderPage({ id: 1, email: 'axelle@example.com' });

    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link.getAttribute('href')).toContain('/app/dashboard');
  });
});
