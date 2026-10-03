import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { updateDetails, updateSnapshot } from '../helpers/updater';

describe('UpdateProgressModal', () => {
  it('allows cancelled downloads to close without resetting updater state', () => {
    const onOpenChange = vi.fn();
    const props = { open: true, version: '1.4.2', onOpenChange, onCancel: vi.fn(), onRetry: vi.fn(), onInstall: vi.fn() };
    const { rerender } = render(<UpdateProgressModal {...props} status={updateSnapshot({ status: 'downloading', update: updateDetails() })} />);
    rerender(<UpdateProgressModal {...props} status={updateSnapshot({ status: 'cancelled', update: updateDetails() }, 2)} />);
    expect(screen.getByText(/download cancelled/i)).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^close$/i })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('shows request progress while retrying an earlier error', () => {
    render(<UpdateProgressModal open version="2.0.0" starting
      status={updateSnapshot({ status: 'error', update: updateDetails(), error: 'Old error' })}
      onOpenChange={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onInstall={vi.fn()} />);
    expect(screen.getByText('Downloading v2.0.0...')).toBeTruthy();
    expect(screen.queryByText('Old error')).toBeNull();
  });
});
