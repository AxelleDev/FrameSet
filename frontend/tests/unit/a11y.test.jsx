/**
 * Automated accessibility smoke tests (axe-core via vitest-axe).
 *
 * These assert that key shared components render without axe violations. They
 * complement — they do not replace — manual keyboard/screen-reader testing.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);
import Alert from '../../src/components/Alert';
import Button from '../../src/components/Button';
import Avatar from '../../src/components/Avatar';
import Badge from '../../src/components/Badge';
import FormField from '../../src/components/FormField';
import TextInput from '../../src/components/TextInput';

describe('accessibilité (axe-core)', () => {
  it('Alert : aucune violation pour toutes les variantes', async () => {
    const { container } = render(
      <>
        <Alert variant="danger">Une erreur est survenue.</Alert>
        <Alert variant="success">Action réussie.</Alert>
        <Alert variant="info">Information.</Alert>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Button / Avatar / Badge : aucune violation', async () => {
    const { container } = render(
      <>
        <Button>Valider</Button>
        <Avatar initials="PN" />
        <Badge color="blue">Actif</Badge>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FormField : label associé + erreur reliée, aucune violation', async () => {
    const { container } = render(
      <FormField label="Email" required error="Format d'email invalide.">
        <TextInput type="email" value="" onChange={() => {}} />
      </FormField>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
