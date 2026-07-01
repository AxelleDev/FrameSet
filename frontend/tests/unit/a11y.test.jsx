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

describe('accessibility (axe-core)', () => {
  it('Alert: no violations for any variant', async () => {
    const { container } = render(
      <>
        <Alert variant="danger">Something went wrong.</Alert>
        <Alert variant="success">Action succeeded.</Alert>
        <Alert variant="info">Information.</Alert>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Button / Avatar / Badge: no violations', async () => {
    const { container } = render(
      <>
        <Button>Submit</Button>
        <Avatar initials="JD" />
        <Badge color="blue">Active</Badge>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FormField: associated label + linked error, no violations', async () => {
    const { container } = render(
      <FormField label="Email" required error="Invalid email format.">
        <TextInput type="email" value="" onChange={() => {}} />
      </FormField>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
