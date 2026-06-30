import React from 'react';
import { render, screen } from '@testing-library/react';
import PageHeader from '../../src/components/PageHeader';

describe('PageHeader', () => {
  it('affiche le titre', () => {
    render(<PageHeader title="Palette de Couleurs" />);
    expect(screen.getByRole('heading', { name: 'Palette de Couleurs' })).toBeInTheDocument();
  });

  it('affiche le sous-titre quand fourni', () => {
    render(<PageHeader title="T" subtitle="Une description" />);
    expect(screen.getByText('Une description')).toBeInTheDocument();
  });

  it('rend le slot actions à droite', () => {
    render(<PageHeader title="T" actions={<button>Importer</button>} />);
    expect(screen.getByRole('button', { name: 'Importer' })).toBeInTheDocument();
  });
});
