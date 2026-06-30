import React from 'react';
import { render, screen } from '@testing-library/react';
import CopyBadge from '../../src/components/CopyBadge';

describe('CopyBadge', () => {
  it('affiche le label par défaut quand rien n’est copié', () => {
    render(<CopyBadge isCopied={false} />);
    expect(screen.getByText('Copier')).toBeInTheDocument();
  });

  it('affiche le label "copié" après copie', () => {
    render(<CopyBadge isCopied={true} />);
    expect(screen.getByText('Copié !')).toBeInTheDocument();
  });

  it('accepte des labels personnalisés', () => {
    render(<CopyBadge isCopied={false} defaultLabel="Copier le hex" />);
    expect(screen.getByText('Copier le hex')).toBeInTheDocument();
  });
});
