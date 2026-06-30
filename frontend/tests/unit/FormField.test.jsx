import React from 'react';
import { render, screen } from '@testing-library/react';
import FormField from '../../src/components/FormField';

describe('FormField', () => {
  it('associe le label au champ (accessible par son label)', () => {
    render(
      <FormField label="Adresse Email">
        <input type="email" />
      </FormField>
    );
    // getByLabelText ne fonctionne que si htmlFor/id sont correctement câblés.
    expect(screen.getByLabelText('Adresse Email')).toBeInTheDocument();
  });

  it('respecte un id explicite fourni sur le champ', () => {
    render(
      <FormField label="Nom" id="custom-id">
        <input />
      </FormField>
    );
    expect(screen.getByLabelText('Nom')).toHaveAttribute('id', 'custom-id');
  });

  it('rend le champ même sans label', () => {
    render(
      <FormField>
        <input placeholder="sans-label" />
      </FormField>
    );
    expect(screen.getByPlaceholderText('sans-label')).toBeInTheDocument();
  });
});
