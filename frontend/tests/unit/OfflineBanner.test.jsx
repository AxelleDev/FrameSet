import { render, screen, act } from '@testing-library/react';
import OfflineBanner from '../../src/components/OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('appears when the browser goes offline and leaves when it reconnects', () => {
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('starts visible when the page loads already offline', () => {
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      render(<OfflineBanner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    } finally {
      onLineSpy.mockRestore();
    }
  });
});
