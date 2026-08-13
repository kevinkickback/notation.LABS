import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

describe('Dialog', () => {
  it('keeps content inside the viewport and provides a scrollable body', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Viewport-safe dialog</DialogTitle>
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
          <DialogBody>Form fields</DialogBody>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');

    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.className).not.toContain('overflow-y-auto');
  });
});
