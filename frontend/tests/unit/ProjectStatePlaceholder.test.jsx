import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectStatePlaceholder from '../../src/components/ProjectStatePlaceholder';

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProjectStatePlaceholder', () => {
  it('shows a loading state', () => {
    renderIn(<ProjectStatePlaceholder loading />);
    expect(screen.getByText(/loading project/i)).toBeInTheDocument();
  });

  it('shows "project not found" + a link to the dashboard', () => {
    renderIn(<ProjectStatePlaceholder loading={false} />);
    expect(screen.getByText(/project not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/app/dashboard');
  });
});
