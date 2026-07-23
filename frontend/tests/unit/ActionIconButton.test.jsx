import React from 'react';
import { render, screen } from '@testing-library/react';
import ActionIconButton from '../../src/components/ActionIconButton';

describe('ActionIconButton', () => {
  it('renders an accessible, always-visible icon button by default', () => {
    render(
      <ActionIconButton title="Edit color">
        <svg />
      </ActionIconButton>,
    );
    const button = screen.getByRole('button', { name: 'Edit color' });
    expect(button.className).not.toMatch(/\bsr-only\b/);
  });

  it('keeps a srOnly button reachable and focusable, but visible only once focused', () => {
    render(
      <ActionIconButton title="Move color left" srOnly>
        <svg />
      </ActionIconButton>,
    );
    const button = screen.getByRole('button', { name: 'Move color left' });
    // Hidden by default (sr-only), but the focus:not-sr-only escape hatch means
    // a keyboard user tabbing to it actually sees it, not just screen readers.
    expect(button.className).toMatch(/\bsr-only\b/);
    expect(button.className).toMatch(/focus:not-sr-only/);
    expect(button.className).toMatch(/focus-ring/);
  });
});
