import type { UpdaterBridge } from '@/lib/updater/ipcContract';

declare global {
  interface Window {
    electronAPI: UpdaterBridge & {
      platform: string;
      versions: {
        electron: string;
        chrome: string;
        node: string;
      };

      saveFile: (
        buffer: Uint8Array,
        filename: string,
        mimeType: string,
      ) => Promise<{ success: boolean; error?: string; path?: string }>;
    };
  }
}
