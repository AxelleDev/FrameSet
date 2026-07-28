import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PublicTopBar from '../../src/components/PublicTopBar';

describe('PublicTopBar', () => {
  it('links the logo to the homepage and shows the theme toggle', () => {
    render(
      <MemoryRouter>
        <PublicTopBar />
      </MemoryRouter>,
    );

    const homeLink = screen.getByRole('link', { name: /go to homepage/i });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(screen.getByRole('button')).toBeInTheDocument(); // theme toggle
  });

  it('scrolls back to the top when the logo is clicked (a same-page click never re-navigates)', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <PublicTopBar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: /go to homepage/i }));

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    scrollTo.mockRestore();
  });
});
