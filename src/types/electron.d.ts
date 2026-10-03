import type { UpdaterBridge } from '@/lib/updater/ipcContract';
import type { BackupBridge } from '@/lib/backup/exportContract';

declare global {
  interface Window {
    electronAPI: UpdaterBridge &
      BackupBridge & {
        platform: string;
        versions: {
          electron: string;
          chrome: string;
          node: string;
        };
      };
  }
}
