import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('frameset_user'));
    } catch {
      return null;
    }
  })();
  const homeLink = user && user.token ? '/app/dashboard' : '/login';
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
