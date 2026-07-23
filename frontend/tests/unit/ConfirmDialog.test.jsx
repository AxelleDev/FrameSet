import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('enables confirmation only when the expected word is typed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete my account"
        subtitle="Type the requested word"
        message="Irreversible action"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={() => {}}
        confirmationWord="DELETE"
        confirmationInputLabel="Type the confirmation word"
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    const input = screen.getByLabelText(/type the confirmation word/i);

    expect(confirmButton).toBeDisabled();

    await user.type(input, 'delete');
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELETE');

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lets the user confirm directly when no confirmation word is required', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete"
        message="Confirm?"
        confirmLabel="Confirm"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });
});
