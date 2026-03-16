import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { UserSettings } from '@/lib/types';

export function useSettings() {
	const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
	const settingsVersion = useAppStore((state) => state.settingsVersion);

	// biome-ignore lint/correctness/useExhaustiveDependencies: settingsVersion is an intentional re-fetch trigger
	useEffect(() => {
		indexedDbStorage.settings
			.get()
			.then(setSettings)
			.catch(() => {
				setSettings(DEFAULT_SETTINGS);
			});
	}, [settingsVersion]);

	return settings;
}
