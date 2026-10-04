import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportProgressModal } from '@/components/header/ImportDialog';

describe('import progress', () => {
  it.each([0, null])('shows validation instead of an empty video counter for total %s', (total) => {
    render(<ImportProgressModal phase="videos" current={0} total={total} onCancel={vi.fn()} />);
    expect(screen.getByText('Checking library records…')).toBeTruthy();
    expect(screen.queryByText(/Importing video/)).toBeNull();
  });

  it('shows video counts and disables cancellation during final saving', () => {
    const { rerender } = render(<ImportProgressModal phase="videos" current={1} total={2} onCancel={vi.fn()} />);
    expect(screen.getByText('Importing video 1 of 2…')).toBeTruthy();
    rerender(<ImportProgressModal phase="committing" current={2} total={2} onCancel={vi.fn()} />);
    expect(screen.getByText('Saving the restored library. Please wait…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Cancel import' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
