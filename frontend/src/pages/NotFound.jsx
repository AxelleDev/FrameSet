/**
 * 404 page (route: catch-all "*").
 *
 * Shown for any unmatched route. The "home" link points to the dashboard when
 * the user is authenticated, otherwise to the login page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const homeLink = user ? '/app/dashboard' : '/login';

  return (
    <div style={{ textAlign: 'center', marginTop: '10vh' }}>
      <h1 style={{ fontSize: '3rem', color: '#FF9292' }}>404</h1>
      <p style={{ fontSize: '1.5rem' }}>Page non trouvée</p>
      <Link to={homeLink} style={{ color: '#8994DF', fontSize: '1.2rem' }}>
        Retour à l'accueil
      </Link>
    </div>
  );
};
