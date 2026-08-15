import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CharacterView } from '@/components/character/CharacterView';
import { ComboView } from '@/components/combo/ComboView';
import { GameLibrary } from '@/components/game/GameLibrary';
import { BreadcrumbBar } from '@/components/header/BreadcrumbBar';
import { Header } from '@/components/header/Header';
import { Toaster } from '@/components/ui/sonner';
import { ChangelogModal } from '@/components/updates/ChangelogModal';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { useSettings } from '@/context/SettingsContext';
import { getFontFamilyCSS } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';

function App() {
  const { selectedGameId, selectedCharacterId } = useAppStore();
  const settings = useSettings();

  const [autoUpdateVersion, setAutoUpdateVersion] = useState<string | null>(
    null,
  );
  const [autoUpdateChangelog, setAutoUpdateChangelog] = useState<string | null>(
    null,
  );
  const [showAutoChangelog, setShowAutoChangelog] = useState(false);
  const [showAutoProgress, setShowAutoProgress] = useState(false);
  const [autoUpdatePortable, setAutoUpdatePortable] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--app-font-family',
      getFontFamilyCSS(settings.fontFamily),
    );
    document.documentElement.style.setProperty(
      '--accent-color',
      settings.accentColor || '#3b82f6',
    );
    document.documentElement.classList.toggle(
      'dark',
      settings.colorTheme === 'dark',
    );
  }, [settings.fontFamily, settings.accentColor, settings.colorTheme]);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateAvailable) return;

    const unsub = window.electronAPI.onUpdateAvailable((data) => {
      try {
        setAutoUpdateVersion(data.version);
        setAutoUpdateChangelog(data.changelog);
        setAutoUpdatePortable(data.isPortable);
        toast.info(`Update v${data.version} available`, {
          action: {
            label: 'View',
            onClick: () => setShowAutoChangelog(true),
          },
          duration: 10000,
        });
      } catch (err) {
        reportError('App.onUpdateAvailable', err);
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    const setAutoCheck = window.electronAPI?.setAutoCheck;
    if (!setAutoCheck) return;

    void setAutoCheck(settings.autoUpdate).catch((err) => {
      reportError('App.setAutoCheck', err);
    });
  }, [settings.autoUpdate]);

  const handleAutoInstall = useCallback(async () => {
    setShowAutoChangelog(false);
    const downloadUpdate = window.electronAPI?.downloadUpdate;
    if (!downloadUpdate) {
      toast.error('Updates are unavailable in this environment.');
      return;
    }

    if (!autoUpdatePortable) {
      setShowAutoProgress(true);
    }
    try {
      const result = await downloadUpdate();
      if (!result.success) {
        setShowAutoProgress(false);
        toast.error(result.error ?? 'Could not start the update.');
      }
    } catch (err) {
      setShowAutoProgress(false);
      reportError('App.handleAutoInstall', err);
      toast.error('Could not start the update.');
    }
  }, [autoUpdatePortable]);

  const games = useLiveQuery(indexedDbStorage.games.getAll, []);
  const characters = useLiveQuery(
    () =>
      selectedGameId
        ? indexedDbStorage.characters.getByGame(selectedGameId)
        : [],
    [selectedGameId],
  );
  const combos = useLiveQuery(
    () =>
      selectedCharacterId
        ? indexedDbStorage.combos.getByCharacter(selectedCharacterId)
        : [],
    [selectedCharacterId, settings.parsedNotationVersion],
  );

  const selectedGame = useMemo(
    () => games?.find((g) => g.id === selectedGameId),
    [games, selectedGameId],
  );
  const selectedCharacter = useMemo(
    () => characters?.find((c) => c.id === selectedCharacterId),
    [characters, selectedCharacterId],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header activeGame={selectedGame} />
      <BreadcrumbBar
        selectedGame={selectedGame}
        selectedCharacter={selectedCharacter}
      />

      <main className="container mx-auto px-4 py-8">
        {!selectedGameId && <GameLibrary games={games || []} />}

        {selectedGameId && !selectedCharacterId && selectedGame && (
          <CharacterView game={selectedGame} characters={characters || []} />
        )}

        {selectedCharacterId && selectedGame && selectedCharacter && (
          <ComboView
            game={selectedGame}
            character={selectedCharacter}
            combos={combos || []}
          />
        )}
      </main>

      <Toaster />

      <ChangelogModal
        open={showAutoChangelog}
        onOpenChange={setShowAutoChangelog}
        version={autoUpdateVersion ?? ''}
        changelog={autoUpdateChangelog}
        onInstall={handleAutoInstall}
        installLabel={autoUpdatePortable ? 'Open Download Page' : undefined}
      />

      <UpdateProgressModal
        open={showAutoProgress}
        version={autoUpdateVersion ?? ''}
        onOpenChange={setShowAutoProgress}
      />
    </div>
  );
}

export default App;
