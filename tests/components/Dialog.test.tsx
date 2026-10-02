import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogBody,
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

  it('keeps content inside the viewport and provides a scrollable body', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Viewport-safe dialog</DialogTitle>
          <DialogDescription>Dialog layout test</DialogDescription>
          <DialogBody>Scrollable content</DialogBody>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    const body = screen.getByText('Scrollable content');

    expect(dialog.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('overscroll-contain');
  });

  it('lets long forms reserve scrolling for the dialog body', () => {
    render(
      <Dialog open>
        <DialogContent className="flex flex-col overflow-hidden">
          <DialogTitle>Long form</DialogTitle>
          <DialogDescription>Long form layout test</DialogDescription>
          <DialogBody>Form fields</DialogBody>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');

    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.className).not.toContain('overflow-y-auto');
  });
});

describe('AlertDialog', () => {
  it('keeps confirmation content within the viewport', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Viewport-safe confirmation</AlertDialogTitle>
          <AlertDialogDescription>
            Confirmation layout test
          </AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const dialog = screen.getByRole('alertdialog');
    expect(dialog.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog.className).toContain('overflow-y-auto');
  });
});
