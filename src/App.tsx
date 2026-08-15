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
import { useUpdater } from '@/context/UpdaterContext';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';

function App() {
  const { selectedGameId, selectedCharacterId } = useAppStore();
  const settings = useSettings();
  const {
    status: updateStatus,
    availabilityEventId,
    downloadUpdate,
  } = useUpdater();
  const [showAutoChangelog, setShowAutoChangelog] = useState(false);
  const [showAutoProgress, setShowAutoProgress] = useState(false);

  useEffect(() => {
    if (availabilityEventId === 0 || updateStatus.status !== 'available')
      return;
    toast.info(`Update v${updateStatus.version} available`, {
      action: {
        label: 'View',
        onClick: () => setShowAutoChangelog(true),
      },
      duration: 10000,
    });
  }, [availabilityEventId, updateStatus.status, updateStatus.version]);

  const handleAutoInstall = useCallback(async () => {
    setShowAutoChangelog(false);
    if (!updateStatus.isPortable) {
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
  }, [downloadUpdate, updateStatus.isPortable]);

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
        version={updateStatus.version ?? ''}
        changelog={updateStatus.changelog ?? null}
        onInstall={handleAutoInstall}
        installLabel={
          updateStatus.isPortable ? 'Open Download Page' : undefined
        }
      />

      <UpdateProgressModal
        open={showAutoProgress}
        version={updateStatus.version ?? ''}
        onOpenChange={setShowAutoProgress}
      />
    </div>
  );
}

export default App;
