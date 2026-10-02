import { SpinnerGapIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRecoverableLiveQuery } from '@/hooks/useRecoverableLiveQuery';
import { DEFAULT_SETTINGS, getFontFamilyCSS } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { UserSettings } from '@/lib/types';

const INITIAL_SETTINGS: UserSettings = {
  ...DEFAULT_SETTINGS,
  // Avoid scheduling update checks until persisted preferences hydrate.
  autoUpdate: false,
};

const SettingsContext = createContext<UserSettings>(INITIAL_SETTINGS);
const SettingsInitializationContext = createContext({
  initialized: true,
  isReparsing: false,
  error: null as string | null,
  retry: () => {},
});
const SettingsActionsContext = createContext({
  setSetting: async <K extends keyof UserSettings>(
    _key: K,
    _value: UserSettings[K],
  ) => false,
  setNotesPanelOpen: async (_entityId: string, _isOpen: boolean) => {},
});

function ReparseProgressModal() {
  return (
    <Dialog open>
      <DialogContent
        className="max-w-xs sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Updating Combo Parsing...</DialogTitle>
          <DialogDescription>
            notation.LABS is updating stored combos to match the latest notation
            parser. Please wait.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <SpinnerGapIcon className="size-5 animate-spin" />
          <span>Editing is temporarily disabled during this update.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isReparsing, setIsReparsing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const initialization = useRef<{
    attempt: number;
    promise: Promise<void>;
  } | null>(null);
  const [optimisticSettings, setOptimisticSettings] = useState<
    Partial<UserSettings>
  >({});
  const settingsWriteQueue = useRef(Promise.resolve());
  const queueSettingsWrite = useCallback(<T,>(write: () => Promise<T>) => {
    const result = settingsWriteQueue.current.then(write);
    // A failed write reports to its caller while later choices still save.
    settingsWriteQueue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  // Run initialization and data migrations once at mount, outside
  // the useLiveQuery read-only transaction context.
  useEffect(() => {
    let cancelled = false;
    if (initialization.current?.attempt !== attempt) {
      initialization.current = {
        attempt,
        promise: indexedDbStorage.settings.init({
          onReparseStart: () => setIsReparsing(true),
          onReparseEnd: () => setIsReparsing(false),
        }),
      };
    }
    initialization.current.promise
      .then(() => {
        if (!cancelled) setInitialized(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setInitializationError(toUserMessage(err));
        reportError('SettingsProvider.init', err);
        toast.error(`Failed to load saved settings: ${toUserMessage(err)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retryInitialization = useCallback(() => {
    setInitialized(false);
    setInitializationError(null);
    setAttempt((current) => current + 1);
  }, []);

  // Pure read - safe inside useLiveQuery.
  const { data: settings, error: settingsReadError } = useRecoverableLiveQuery(
    indexedDbStorage.settings.get,
    [],
    attempt,
  );
  const currentSettings = {
    ...(settings ?? INITIAL_SETTINGS),
    ...optimisticSettings,
  };

  useEffect(() => {
    if (!settings) return;

    setOptimisticSettings((current) => {
      const next = { ...current };
      let changed = false;

      for (const key of Object.keys(current) as Array<keyof UserSettings>) {
        if (
          current[key] === settings[key] ||
          (key === 'notesOverrides' &&
            current.notesOverrides?.length === 0 &&
            settings.notesOverrides?.length === 0)
        ) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [settings]);

  const setSetting = useCallback(
    async <K extends keyof UserSettings>(
      key: K,
      value: UserSettings[K],
    ): Promise<boolean> => {
      // Choosing a new global notes default resets earlier manual choices.
      const updates: Partial<UserSettings> = {
        [key]: value,
        ...(key === 'notesDefaultOpen' ? { notesOverrides: [] } : {}),
      };
      setOptimisticSettings((current) => ({ ...current, ...updates }));

      try {
        await queueSettingsWrite(() =>
          indexedDbStorage.settings.update(updates),
        );
        return true;
      } catch (error) {
        setOptimisticSettings((current) => {
          if (current[key] !== value) return current;
          const next = { ...current };
          for (const updatedKey of Object.keys(updates) as Array<
            keyof UserSettings
          >) {
            if (current[updatedKey] === updates[updatedKey])
              delete next[updatedKey];
          }
          return next;
        });
        reportError('SettingsProvider.setSetting', error);
        toast.error(`Failed to save setting: ${toUserMessage(error)}`);
        return false;
      }
    },
    [queueSettingsWrite],
  );

  const setNotesPanelOpen = useCallback(
    (entityId: string, isOpen: boolean) =>
      queueSettingsWrite(async () => {
        const persisted = await indexedDbStorage.settings.get();
        // Preserve the user's absolute choice even if an earlier default write failed.
        await indexedDbStorage.settings.setNotesOverride(
          entityId,
          isOpen !== (persisted.notesDefaultOpen ?? false),
        );
      }),
    [queueSettingsWrite],
  );

  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      '--app-font-family',
      getFontFamilyCSS(currentSettings.fontFamily),
    );
    document.documentElement.style.setProperty(
      '--accent-color',
      currentSettings.accentColor || '#3b82f6',
    );
    document.documentElement.classList.toggle(
      'dark',
      currentSettings.colorTheme === 'dark',
    );
  }, [
    currentSettings.fontFamily,
    currentSettings.accentColor,
    currentSettings.colorTheme,
  ]);

  return (
    <SettingsActionsContext.Provider value={{ setSetting, setNotesPanelOpen }}>
      <SettingsContext.Provider value={currentSettings}>
        <SettingsInitializationContext.Provider
          value={{
            initialized:
              initialized && settings !== undefined && !settingsReadError,
            isReparsing,
            error: initializationError ?? settingsReadError,
            retry: retryInitialization,
          }}
        >
          {children}
          {isReparsing && initialized && <ReparseProgressModal />}
        </SettingsInitializationContext.Provider>
      </SettingsContext.Provider>
    </SettingsActionsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
export const useSettingsActions = () => useContext(SettingsActionsContext);
export const useSettingsInitialization = () =>
  useContext(SettingsInitializationContext);
