import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';

let onUpdateCancelledCallback: (() => void) | null = null;

describe('UpdateProgressModal', () => {
  beforeEach(() => {
    onUpdateCancelledCallback = null;
    window.electronAPI = {
      platform: 'win32',
      versions: {
        electron: '40.0.0',
        chrome: '140.0.0',
        node: '22.0.0',
      },
      checkForUpdate: vi.fn(),
      downloadUpdate: vi.fn(),
      cancelUpdate: vi.fn(),
      installUpdate: vi.fn(),
      getUpdateStatus: vi.fn(),
      setAutoCheck: vi.fn(),
      getAppVersion: vi.fn(),
      getCurrentChangelog: vi.fn(),
      onUpdateChecking: vi.fn(() => () => { }),
      onUpdateAvailable: vi.fn(() => () => { }),
      onUpdateNotAvailable: vi.fn(() => () => { }),
      onUpdateError: vi.fn(() => () => { }),
      onDownloadProgress: vi.fn(() => () => { }),
      onUpdateDownloaded: vi.fn(() => () => { }),
      onUpdateCancelled: vi.fn((callback: () => void) => {
        onUpdateCancelledCallback = callback;
        return () => { };
      }),
      saveFile: vi.fn(),
    };
  });

  it('allows cancelled downloads to close the modal', () => {
    const onOpenChange = vi.fn();

    render(
      <UpdateProgressModal
        open={true}
        version="1.4.2"
        onOpenChange={onOpenChange}
      />,
    );

    act(() => {
      onUpdateCancelledCallback?.();
    });

    expect(screen.getByText(/download cancelled/i)).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^close$/i })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
