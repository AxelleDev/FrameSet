import React from 'react';
import { render, screen } from '@testing-library/react';
import CopyBadge from '../../src/components/CopyBadge';

describe('CopyBadge', () => {
  it('shows the default label when nothing is copied', () => {
    render(<CopyBadge isCopied={false} />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('shows the "copied" label after copying', () => {
    render(<CopyBadge isCopied={true} />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('accepts custom labels', () => {
    render(<CopyBadge isCopied={false} defaultLabel="Copy hex" />);
    expect(screen.getByText('Copy hex')).toBeInTheDocument();
  });
});
