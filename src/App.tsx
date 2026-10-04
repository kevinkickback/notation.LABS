import { useCallback, useEffect, useMemo, useState } from 'react';
import { CharacterView } from '@/components/character/CharacterView';
import { ComboView } from '@/components/combo/ComboView';
import { GameLibrary } from '@/components/game/GameLibrary';
import { BreadcrumbBar } from '@/components/header/BreadcrumbBar';
import { Header } from '@/components/header/Header';
import { WorkspaceStatus } from '@/components/shared/WorkspaceStatus';
import { Toaster } from '@/components/ui/sonner';
import { AppLoadingOverlay } from '@/components/workbench/AppLoadingOverlay';
import { WorkspaceFrame } from '@/components/workbench/WorkspaceFrame';
import {
  useSettings,
  useSettingsInitialization,
} from '@/context/SettingsContext';
import { useUpdater } from '@/context/UpdaterContext';
import { useRecoverableLiveQuery } from '@/hooks/useRecoverableLiveQuery';
import { notify } from '@/lib/notifications';
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
    notify.update(`Update v${updateStatus.update?.version} available`, {
      operationId: `update:${updateStatus.update?.version}`,
      historyAction: { type: 'view-update' },
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
    updateStatus.update?.version,
  ]);

  const { data: requestedPage, error: pageError } = useRecoverableLiveQuery(
    async () => {
      const [games, characters, combos] = await Promise.all([
        indexedDbStorage.games.getAll(),
        selectedGameId
          ? indexedDbStorage.characters.getByGame(selectedGameId)
          : [],
        selectedCharacterId
          ? indexedDbStorage.combos.getByCharacter(selectedCharacterId)
          : [],
      ]);
      return {
        gameId: selectedGameId,
        characterId: selectedCharacterId,
        parsedNotationVersion: settings.parsedNotationVersion,
        games,
        characters,
        combos,
      };
    },
    [selectedGameId, selectedCharacterId, settings.parsedNotationVersion],
    queryAttempt,
  );
  const pageIsCurrent =
    requestedPage !== undefined &&
    requestedPage.gameId === selectedGameId &&
    requestedPage.characterId === selectedCharacterId &&
    requestedPage.parsedNotationVersion === settings.parsedNotationVersion;
  const [previousPage, setPreviousPage] = useState(requestedPage);
  useEffect(() => {
    if (pageIsCurrent) setPreviousPage(requestedPage);
  }, [requestedPage, pageIsCurrent]);
  // Keep the last complete screen while the destination's reads are pending.
  const page = pageIsCurrent ? requestedPage : previousPage;

  const selectedGame = useMemo(
    () => page?.games.find((game) => game.id === page.gameId),
    [page],
  );
  const selectedCharacter = useMemo(
    () =>
      page?.characters.find((character) => character.id === page.characterId),
    [page],
  );

  const startupStage = initialization.isReparsing
    ? 'parsing'
    : !initialization.initialized
      ? 'settings'
      : !pageIsCurrent
        ? 'library'
        : 'ready';
  const startupError = initialization.error ?? pageError;
  const workspaceBlocked = starting || Boolean(startupError);
  const retryStartup = () => {
    setStarting(true);
    initialization.retry();
    setQueryAttempt((current) => current + 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="app-workspace min-h-screen flex flex-col"
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

            <WorkspaceFrame
              footer={<WorkspaceStatus />}
              aria-busy={!pageIsCurrent}
              inert={!pageIsCurrent}
            >
              {page && !page.gameId && <GameLibrary games={page.games} />}

              {page?.gameId && !page.characterId && selectedGame && (
                <CharacterView
                  game={selectedGame}
                  characters={page.characters}
                />
              )}

              {page?.characterId && selectedGame && selectedCharacter && (
                <ComboView
                  game={selectedGame}
                  character={selectedCharacter}
                  combos={page.combos}
                />
              )}
            </WorkspaceFrame>
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
