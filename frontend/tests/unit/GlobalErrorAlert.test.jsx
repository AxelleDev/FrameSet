import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalErrorAlert from '../../src/components/GlobalErrorAlert';

describe('GlobalErrorAlert', () => {
  it('shows a friendly message for a technical network error', () => {
    render(<GlobalErrorAlert message="Failed to fetch" />);

    expect(
      screen.getByText(/couldn't reach the server/i)
    ).toBeInTheDocument();
  });

  it('triggers the close handler when the dismiss button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<GlobalErrorAlert message="Test error" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /dismiss alert/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
