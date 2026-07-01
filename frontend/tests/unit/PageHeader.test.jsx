import React from 'react';
import { render, screen } from '@testing-library/react';
import PageHeader from '../../src/components/PageHeader';

describe('PageHeader', () => {
  it('shows the title', () => {
    render(<PageHeader title="Color Palette" />);
    expect(screen.getByRole('heading', { name: 'Color Palette' })).toBeInTheDocument();
  });

  it('shows the subtitle when provided', () => {
    render(<PageHeader title="T" subtitle="A description" />);
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('renders the actions slot on the right', () => {
    render(<PageHeader title="T" actions={<button>Import</button>} />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });
});
