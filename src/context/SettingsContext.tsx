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
import { initializeApplication } from '@/lib/application/initializeApplication';
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
  setSettings: async (_updates: Partial<UserSettings>) => false,
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
  const requestSequence = useRef(0);
  const latestSettingsRequests = useRef<
    Partial<Record<keyof UserSettings, number>>
  >({});
  const [appliedRevision, setAppliedRevision] = useState(0);
  const settingsWriteQueue = useRef(Promise.resolve());
  const queueSettingsWrite = useCallback(<T,>(write: () => Promise<T>) => {
    const request = ++requestSequence.current;
    const result = settingsWriteQueue.current.then(write);
    // A failed write reports to its caller while later choices still save.
    const finish = () => setAppliedRevision(request);
    settingsWriteQueue.current = result.then(finish, finish);
    return { request, result };
  }, []);

  // Run initialization and data migrations once at mount, outside
  // the useLiveQuery read-only transaction context.
  useEffect(() => {
    let cancelled = false;
    if (initialization.current?.attempt !== attempt) {
      initialization.current = {
        attempt,
        promise: initializeApplication({
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
  const { data: settingsSnapshot, error: settingsReadError } =
    useRecoverableLiveQuery(
      async () => ({
        settings: await indexedDbStorage.settings.get(),
        appliedThrough: appliedRevision,
      }),
      [appliedRevision],
      attempt,
    );
  const settings = settingsSnapshot?.settings;
  const currentSettings = {
    ...(settings ?? INITIAL_SETTINGS),
    ...optimisticSettings,
  };

  useEffect(() => {
    if (!settingsSnapshot) return;

    setOptimisticSettings((current) => {
      const next = { ...current };
      let changed = false;

      for (const key of Object.keys(current) as Array<keyof UserSettings>) {
        const request = latestSettingsRequests.current[key];
        if (
          request !== undefined &&
          request <= settingsSnapshot.appliedThrough
        ) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [settingsSnapshot]);

  const setSettings = useCallback(
    async (updates: Partial<UserSettings>): Promise<boolean> => {
      const { request, result } = queueSettingsWrite(() =>
        indexedDbStorage.settings.update(updates),
      );
      for (const updatedKey of Object.keys(updates) as Array<
        keyof UserSettings
      >) {
        latestSettingsRequests.current[updatedKey] = request;
      }
      setOptimisticSettings((current) => ({ ...current, ...updates }));

      try {
        await result;
        return true;
      } catch (error) {
        setOptimisticSettings((current) => {
          const next = { ...current };
          for (const updatedKey of Object.keys(updates) as Array<
            keyof UserSettings
          >) {
            if (latestSettingsRequests.current[updatedKey] === request)
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

  const setSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
      setSettings({ [key]: value }),
    [setSettings],
  );

  const setNotesPanelOpen = useCallback(
    (entityId: string, isOpen: boolean) =>
      queueSettingsWrite(() =>
        indexedDbStorage.settings.setNotebookOpen(entityId, isOpen),
      ).result,
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
    <SettingsActionsContext.Provider
      value={{ setSetting, setSettings, setNotesPanelOpen }}
    >
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
