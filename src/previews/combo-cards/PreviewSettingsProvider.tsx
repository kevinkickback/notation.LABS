import { type ReactNode, useCallback, useState } from 'react';
import { SettingsPresentationProvider } from '@/context/SettingsPresentation';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { UserSettings } from '@/lib/types';

export function PreviewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, updateSettings] = useState<UserSettings>({
    ...DEFAULT_SETTINGS,
    autoUpdate: false,
    notationColors: {
      ...DEFAULT_SETTINGS.notationColors,
      direction: 'var(--preview-direction)',
      separator: 'var(--muted-foreground)',
    },
  });
  const setSettings = useCallback((updates: Partial<UserSettings>) => {
    updateSettings((current) => ({ ...current, ...updates }));
    return Promise.resolve(true);
  }, []);
  const setSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
      setSettings({ [key]: value }),
    [setSettings],
  );

  return (
    <SettingsPresentationProvider
      settings={settings}
      actions={{
        setSettings,
        setSetting,
        // Sample cards do not have notebooks.
        setNotesPanelOpen: async () => {},
      }}
    >
      {children}
    </SettingsPresentationProvider>
  );
}
