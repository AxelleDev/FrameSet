import React from 'react';
import { render, screen } from '@testing-library/react';
import FormField from '../../src/components/FormField';

describe('FormField', () => {
  it('associates the label with the field (accessible by its label)', () => {
    render(
      <FormField label="Email Address">
        <input type="email" />
      </FormField>
    );
    // getByLabelText only works if htmlFor/id are wired up correctly.
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('honors an explicit id provided on the field', () => {
    render(
      <FormField label="Name" id="custom-id">
        <input />
      </FormField>
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'custom-id');
  });

  it('renders the field even without a label', () => {
    render(
      <FormField>
        <input placeholder="no-label" />
      </FormField>
    );
    expect(screen.getByPlaceholderText('no-label')).toBeInTheDocument();
  });
});
