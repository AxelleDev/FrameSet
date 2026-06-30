import React from 'react';
import { render, screen } from '@testing-library/react';
import PasswordChecklist from '../../src/components/PasswordChecklist';

describe('PasswordChecklist', () => {
  it('coche les 4 règles pour un mot de passe conforme', () => {
    render(<PasswordChecklist password="Pass1234" />);
    expect(screen.getAllByText('✓')).toHaveLength(4);
  });

  it("n'en coche aucune pour un mot de passe vide", () => {
    render(<PasswordChecklist password="" />);
    expect(screen.queryAllByText('✓')).toHaveLength(0);
  });

  it('coche partiellement selon les règles remplies', () => {
    // "abcdefgh" : longueur OK + minuscule OK, mais pas de majuscule ni chiffre.
    render(<PasswordChecklist password="abcdefgh" />);
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });
});
