import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CharacterView } from '@/components/character/CharacterView';
import { ComboView } from '@/components/combo/ComboView';
import { GameLibrary } from '@/components/game/GameLibrary';
import { BreadcrumbBar } from '@/components/header/BreadcrumbBar';
import { Header } from '@/components/header/Header';
import { Toaster } from '@/components/ui/sonner';
import { AppLoadingOverlay } from '@/components/workbench/AppLoadingOverlay';
import {
  useSettings,
  useSettingsInitialization,
} from '@/context/SettingsContext';
import { useUpdater } from '@/context/UpdaterContext';
import { useRecoverableLiveQuery } from '@/hooks/useRecoverableLiveQuery';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';

function App() {
  const { selectedGameId, selectedCharacterId } = useAppStore();
  const settings = useSettings();
  const initialization = useSettingsInitialization();
  const [starting, setStarting] = useState(true);
  const [queryAttempt, setQueryAttempt] = useState(0);
  const finishStartup = useCallback(() => setStarting(false), []);
  const {
    status: updateStatus,
    availabilityEventId,
    showAvailableUpdate,
  } = useUpdater();

  useEffect(() => {
    if (availabilityEventId === 0 || updateStatus.status !== 'available')
      return;
    toast.info(`Update v${updateStatus.version} available`, {
      action: {
        label: 'View',
        onClick: () => showAvailableUpdate(),
      },
      duration: 10000,
    });
  }, [
    availabilityEventId,
    showAvailableUpdate,
    updateStatus.status,
    updateStatus.version,
  ]);

  const { data: games, error: gamesError } = useRecoverableLiveQuery(
    indexedDbStorage.games.getAll,
    [],
    queryAttempt,
  );
  const { data: characters, error: charactersError } = useRecoverableLiveQuery(
    () =>
      selectedGameId
        ? indexedDbStorage.characters.getByGame(selectedGameId)
        : [],
    [selectedGameId],
    queryAttempt,
  );
  const { data: combos, error: combosError } = useRecoverableLiveQuery(
    () =>
      selectedCharacterId
        ? indexedDbStorage.combos.getByCharacter(selectedCharacterId)
        : [],
    [selectedCharacterId, settings.parsedNotationVersion],
    queryAttempt,
  );

  const selectedGame = useMemo(
    () => games?.find((g) => g.id === selectedGameId),
    [games, selectedGameId],
  );
  const selectedCharacter = useMemo(
    () => characters?.find((c) => c.id === selectedCharacterId),
    [characters, selectedCharacterId],
  );

  const startupStage = initialization.isReparsing
    ? 'parsing'
    : !initialization.initialized
      ? 'settings'
      : games === undefined ||
          (selectedGameId && characters === undefined) ||
          (selectedCharacterId && combos === undefined)
        ? 'library'
        : 'ready';
  const startupError =
    initialization.error ?? gamesError ?? charactersError ?? combosError;
  const workspaceBlocked = starting || Boolean(startupError);
  const retryStartup = () => {
    setStarting(true);
    initialization.retry();
    setQueryAttempt((current) => current + 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="app-workspace"
        inert={workspaceBlocked}
        aria-hidden={workspaceBlocked || undefined}
      >
        {!workspaceBlocked && (
          <>
            <Header activeGame={selectedGame} />
            <BreadcrumbBar
              selectedGame={selectedGame}
              selectedCharacter={selectedCharacter}
            />

            <main className="container mx-auto px-4 py-8">
              {!selectedGameId && <GameLibrary games={games || []} />}

              {selectedGameId && !selectedCharacterId && selectedGame && (
                <CharacterView
                  game={selectedGame}
                  characters={characters || []}
                />
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
          </>
        )}
      </div>
      {workspaceBlocked && (
        <AppLoadingOverlay
          stage={startupStage}
          error={startupError}
          onRetry={retryStartup}
          onComplete={finishStartup}
        />
      )}
    </div>
  );
}

export default App;
