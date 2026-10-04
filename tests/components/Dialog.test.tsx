import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

describe('Dialog', () => {
  it('returns focus to the invoking control for a controlled dialog', async () => {
    function ControlledDialog() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open editor</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Editor</DialogTitle>
              <DialogDescription>Edit a field</DialogDescription>
              <input aria-label="Field" />
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    render(<ControlledDialog />);
    const opener = screen.getByRole('button', { name: 'Open editor' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
  });
});
