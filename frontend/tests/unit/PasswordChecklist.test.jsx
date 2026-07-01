import React from 'react';
import { render, screen } from '@testing-library/react';
import PasswordChecklist from '../../src/components/PasswordChecklist';

describe('PasswordChecklist', () => {
  it('checks all 4 rules for a compliant password', () => {
    render(<PasswordChecklist password="Pass1234" />);
    expect(screen.getAllByText('✓')).toHaveLength(4);
  });

  it('checks none for an empty password', () => {
    render(<PasswordChecklist password="" />);
    expect(screen.queryAllByText('✓')).toHaveLength(0);
  });

  it('partially checks based on the rules met', () => {
    // "abcdefgh": length OK + lowercase OK, but no uppercase or digit.
    render(<PasswordChecklist password="abcdefgh" />);
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });
});
