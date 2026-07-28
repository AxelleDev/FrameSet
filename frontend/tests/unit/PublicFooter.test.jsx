import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PublicFooter from '../../src/components/PublicFooter';

describe('PublicFooter', () => {
  it('links the logo home and to the legal pages, and shows the current year', () => {
    render(
      <MemoryRouter>
        <PublicFooter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} FrameSet`)),
    ).toBeInTheDocument();
  });

  it('scrolls back to the top when the logo is clicked (a same-page click never re-navigates)', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <PublicFooter />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: /go to homepage/i }));

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    scrollTo.mockRestore();
  });
});
