import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { reportError, toUserMessage } from '@/lib/errors';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { UserSettings } from '@/lib/types';
import { toast } from 'sonner';

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
    const settings = useLiveQuery(indexedDbStorage.settings.get, [], DEFAULT_SETTINGS);

    return (
        <SettingsContext.Provider value={settings ?? DEFAULT_SETTINGS}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
