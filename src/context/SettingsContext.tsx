import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { UserSettings } from '@/lib/types';

const SettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Run initialization and data migrations once at mount, outside
  // the useLiveQuery read-only transaction context.
  useEffect(() => {
    indexedDbStorage.settings.init().catch((err) => {
      reportError('SettingsProvider.init', err);
      toast.error(`Failed to load saved settings: ${toUserMessage(err)}`);
    });
  }, []);

  // Pure read - safe inside useLiveQuery.
  const settings = useLiveQuery(
    indexedDbStorage.settings.get,
    [],
    DEFAULT_SETTINGS,
  );

  return (
    <SettingsContext.Provider value={settings ?? DEFAULT_SETTINGS}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
