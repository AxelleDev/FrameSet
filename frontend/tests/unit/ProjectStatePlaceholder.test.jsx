import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectStatePlaceholder from '../../src/components/ProjectStatePlaceholder';

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProjectStatePlaceholder', () => {
  it('affiche un état de chargement', () => {
    renderIn(<ProjectStatePlaceholder loading />);
    expect(screen.getByText(/chargement du projet/i)).toBeInTheDocument();
  });

  it('affiche "projet introuvable" + un lien vers le tableau de bord', () => {
    renderIn(<ProjectStatePlaceholder loading={false} />);
    expect(screen.getByText(/projet introuvable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tableau de bord/i })).toHaveAttribute('href', '/app/dashboard');
  });
});
