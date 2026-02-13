import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', marginTop: '10vh' }}>
      <h1 style={{ fontSize: '3rem', color: '#FF9292' }}>404</h1>
      <p style={{ fontSize: '1.5rem' }}>Page non trouvée</p>
      <Link to="/" style={{ color: '#8994DF', fontSize: '1.2rem' }}>
        Retour à l'accueil
      </Link>
    </div>
  );
}
