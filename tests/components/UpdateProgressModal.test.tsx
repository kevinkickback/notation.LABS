import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';

const { useUpdaterMock } = vi.hoisted(() => ({
  useUpdaterMock: vi.fn(),
}));

vi.mock('@/context/UpdaterContext', () => ({
  useUpdater: () => useUpdaterMock(),
}));

describe('UpdateProgressModal', () => {
  beforeEach(() => {
    useUpdaterMock.mockReturnValue({
      status: { status: 'downloading' },
      downloadUpdate: vi.fn(),
      cancelUpdate: vi.fn(),
      installUpdate: vi.fn(),
    });
  });

  it('allows cancelled downloads to close the modal', () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <UpdateProgressModal
        open={true}
        version="1.4.2"
        onOpenChange={onOpenChange}
      />,
    );

    useUpdaterMock.mockReturnValue({
      status: { status: 'cancelled' },
      downloadUpdate: vi.fn(),
      cancelUpdate: vi.fn(),
      installUpdate: vi.fn(),
    });
    rerender(
      <UpdateProgressModal
        open={true}
        version="1.4.2"
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText(/download cancelled/i)).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^close$/i })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
