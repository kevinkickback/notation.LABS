import {
  type ContextType,
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
} from 'react';
import { getAccentAppearance } from '@/lib/accentAppearance';
import { DEFAULT_SETTINGS, getFontFamilyCSS } from '@/lib/defaults';
import type { UserSettings } from '@/lib/types';

const SettingsContext = createContext<UserSettings>({
  ...DEFAULT_SETTINGS,
  autoUpdate: false,
});
const SettingsActionsContext = createContext({
  setSettings: async (_updates: Partial<UserSettings>) => false,
  setSetting: async <K extends keyof UserSettings>(
    _key: K,
    _value: UserSettings[K],
  ) => false,
  setNotesPanelOpen: async (_entityId: string, _isOpen: boolean) => {},
});

export function SettingsPresentationProvider({
  settings,
  actions,
  children,
}: {
  settings: UserSettings;
  actions: ContextType<typeof SettingsActionsContext>;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    const accent = getAccentAppearance(settings.accentColor);
    document.documentElement.style.setProperty(
      '--app-font-family',
      getFontFamilyCSS(settings.fontFamily),
    );
    document.documentElement.style.setProperty(
      '--accent-color',
      accent.background,
    );
    document.documentElement.style.setProperty(
      '--accent-foreground',
      accent.foreground,
    );
    document.documentElement.classList.toggle(
      'dark',
      settings.colorTheme === 'dark',
    );
  }, [settings.fontFamily, settings.accentColor, settings.colorTheme]);

  return (
    <SettingsActionsContext.Provider value={actions}>
      <SettingsContext.Provider value={settings}>
        {children}
      </SettingsContext.Provider>
    </SettingsActionsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
export const useSettingsActions = () => useContext(SettingsActionsContext);
