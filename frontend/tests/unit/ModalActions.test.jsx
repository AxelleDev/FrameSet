import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalActions from '../../src/components/ModalActions';

describe('ModalActions', () => {
  it('renders a default "Cancel" secondary button + the primary', () => {
    render(<ModalActions primaryLabel="Create" onPrimary={() => {}} onSecondary={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('triggers onPrimary / onSecondary', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(<ModalActions primaryLabel="Create" onPrimary={onPrimary} onSecondary={onSecondary} />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('disables the primary with primaryDisabled', () => {
    render(
      <ModalActions
        primaryLabel="Create"
        onPrimary={() => {}}
        onSecondary={() => {}}
        primaryDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
