import {
  CaretDownIcon,
  CaretRightIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react';
import { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { reportError } from '@/lib/errors';
import {
  getLocalVideoId,
  indexedDbStorage,
} from '@/lib/storage/indexedDbStorage';
import type { Character, Combo, Game } from '@/lib/types';

interface ExportProgressModalProps {
  current: number;
  /** null = still preparing (DB reads + filtering); number = archiving in progress */
  total: number | null;
}

/** Blocking modal shown while backup archive is being built. Cannot be dismissed. */
export function ExportProgressModal({
  current,
  total,
}: ExportProgressModalProps) {
  const isFinalizing = total !== null && total > 0 && current >= total;
  const pct =
    total !== null && total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <Dialog open>
      <DialogContent
        className="max-w-xs sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Exporting…</DialogTitle>
          <DialogDescription>
            {total === null
              ? 'Preparing export…'
              : isFinalizing
                ? 'Finalizing backup archive…'
                : `Adding video ${current} of ${total} to backup…`}
          </DialogDescription>
        </DialogHeader>
        {total === null ? (
          <div className="flex justify-center py-2">
            <SpinnerGapIcon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              {isFinalizing ? (
                <div className="h-full w-full rounded-full bg-primary/70 animate-pulse" />
              ) : (
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
            {isFinalizing && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <SpinnerGapIcon className="size-4 animate-spin text-muted-foreground" />
                <span>This can take a bit for large backups.</span>
              </div>
            )}
            {!isFinalizing && (
              <p className="text-xs text-muted-foreground text-right">{pct}%</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (
    includeVideos: boolean,
    filter: { gameIds: string[]; characterIds: string[]; comboIds: string[] },
  ) => void;
}

interface TreeData {
  games: Game[];
  characters: Character[];
  combos: Combo[];
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
}: ExportDialogProps) {
  const [data, setData] = useState<TreeData>({
    games: [],
    characters: [],
    combos: [],
  });
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set());
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(
    new Set(),
  );
  const [includeVideos, setIncludeVideos] = useState(false);
  const [hasLocalVideos, setHasLocalVideos] = useState(false);
  const [loading, setLoading] = useState(true);
  const includeVideosId = useId();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      indexedDbStorage.games.getAll(),
      indexedDbStorage.characters.getAll(),
      indexedDbStorage.combos.getAll(),
      indexedDbStorage.demoVideos.getAll(),
    ])
      .then(([games, characters, combos, videos]) => {
        setData({ games, characters, combos });

        setSelectedGames(new Set(games.map((g) => g.id)));
        setSelectedCharacters(new Set(characters.map((c) => c.id)));
        setSelectedCombos(new Set(combos.map((c) => c.id)));
        setExpandedGames(new Set());
        setExpandedCharacters(new Set());
        setHasLocalVideos(videos.length > 0);
        setIncludeVideos(false);
        setLoading(false);
      })
      .catch((err) => {
        reportError('ExportDialog.loadData', err);
        setData({ games: [], characters: [], combos: [] });
        setSelectedGames(new Set());
        setSelectedCharacters(new Set());
        setSelectedCombos(new Set());
        setExpandedGames(new Set());
        setExpandedCharacters(new Set());
        setHasLocalVideos(false);
        setIncludeVideos(false);
        setLoading(false);
        toast.error('Failed to load export data');
      });
  }, [open]);

  const charactersByGame = useMemo(() => {
    const map = new Map<string, Character[]>();
    for (const char of data.characters) {
      const list = map.get(char.gameId) || [];
      list.push(char);
      map.set(char.gameId, list);
    }
    return map;
  }, [data.characters]);

  const combosByCharacter = useMemo(() => {
    const map = new Map<string, Combo[]>();
    for (const combo of data.combos) {
      const list = map.get(combo.characterId) || [];
      list.push(combo);
      map.set(combo.characterId, list);
    }
    return map;
  }, [data.combos]);

  // Count how many relevant local videos exist for the current selection
  const selectedVideoCount = useMemo(() => {
    if (!hasLocalVideos) return 0;
    return data.combos.filter(
      (c) => selectedCombos.has(c.id) && !!getLocalVideoId(c.demoUrl),
    ).length;
  }, [selectedCombos, data.combos, hasLocalVideos]);

  const toggleGame = (gameId: string) => {
    const next = new Set(selectedGames);
    const chars = charactersByGame.get(gameId) || [];
    const nextChars = new Set(selectedCharacters);
    const nextCombos = new Set(selectedCombos);

    if (next.has(gameId)) {
      next.delete(gameId);
      for (const char of chars) {
        nextChars.delete(char.id);
        for (const combo of combosByCharacter.get(char.id) || []) {
          nextCombos.delete(combo.id);
        }
      }
    } else {
      next.add(gameId);
      for (const char of chars) {
        nextChars.add(char.id);
        for (const combo of combosByCharacter.get(char.id) || []) {
          nextCombos.add(combo.id);
        }
      }
    }
    setSelectedGames(next);
    setSelectedCharacters(nextChars);
    setSelectedCombos(nextCombos);
  };

  const toggleCharacter = (charId: string, gameId: string) => {
    const nextChars = new Set(selectedCharacters);
    const nextCombos = new Set(selectedCombos);
    const combos = combosByCharacter.get(charId) || [];

    if (nextChars.has(charId)) {
      nextChars.delete(charId);
      for (const combo of combos) {
        nextCombos.delete(combo.id);
      }
    } else {
      nextChars.add(charId);
      for (const combo of combos) {
        nextCombos.add(combo.id);
      }
    }
    setSelectedCharacters(nextChars);
    setSelectedCombos(nextCombos);

    // Update game state: select if any child is selected, deselect if none
    const gameChars = charactersByGame.get(gameId) || [];
    const nextGames = new Set(selectedGames);
    if (gameChars.some((c) => nextChars.has(c.id))) {
      nextGames.add(gameId);
    } else {
      nextGames.delete(gameId);
    }
    setSelectedGames(nextGames);
  };

  const toggleCombo = (comboId: string, charId: string, gameId: string) => {
    const nextCombos = new Set(selectedCombos);
    if (nextCombos.has(comboId)) {
      nextCombos.delete(comboId);
    } else {
      nextCombos.add(comboId);
    }
    setSelectedCombos(nextCombos);

    // Update character state
    const charCombos = combosByCharacter.get(charId) || [];
    const nextChars = new Set(selectedCharacters);
    if (charCombos.some((c) => nextCombos.has(c.id))) {
      nextChars.add(charId);
    } else {
      nextChars.delete(charId);
    }
    setSelectedCharacters(nextChars);

    const gameChars = charactersByGame.get(gameId) || [];
    const nextGames = new Set(selectedGames);
    if (gameChars.some((c) => nextChars.has(c.id))) {
      nextGames.add(gameId);
    } else {
      nextGames.delete(gameId);
    }
    setSelectedGames(nextGames);
  };

  const toggleExpandGame = (gameId: string) => {
    const next = new Set(expandedGames);
    if (next.has(gameId)) {
      next.delete(gameId);
    } else {
      next.add(gameId);
    }
    setExpandedGames(next);
  };

  const toggleExpandCharacter = (charId: string) => {
    const next = new Set(expandedCharacters);
    if (next.has(charId)) {
      next.delete(charId);
    } else {
      next.add(charId);
    }
    setExpandedCharacters(next);
  };

  const selectAll = () => {
    setSelectedGames(new Set(data.games.map((g) => g.id)));
    setSelectedCharacters(new Set(data.characters.map((c) => c.id)));
    setSelectedCombos(new Set(data.combos.map((c) => c.id)));
  };

  const selectNone = () => {
    setSelectedGames(new Set());
    setSelectedCharacters(new Set());
    setSelectedCombos(new Set());
  };

  const getGameCheckState = (gameId: string): boolean | 'indeterminate' => {
    const chars = charactersByGame.get(gameId) || [];
    if (chars.length === 0) return selectedGames.has(gameId);
    const allCombos = chars.flatMap((c) => combosByCharacter.get(c.id) || []);
    if (allCombos.length === 0) return selectedGames.has(gameId);
    const selectedCount = allCombos.filter((c) =>
      selectedCombos.has(c.id),
    ).length;
    if (selectedCount === 0) return false;
    if (selectedCount === allCombos.length) return true;
    return 'indeterminate';
  };

  const getCharCheckState = (charId: string): boolean | 'indeterminate' => {
    const combos = combosByCharacter.get(charId) || [];
    if (combos.length === 0) return selectedCharacters.has(charId);
    const selectedCount = combos.filter((c) => selectedCombos.has(c.id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === combos.length) return true;
    return 'indeterminate';
  };

  const handleExport = () => {
    onExport(includeVideos, {
      gameIds: [...selectedGames],
      characterIds: [...selectedCharacters],
      comboIds: [...selectedCombos],
    });
  };

  const nothingSelected =
    selectedGames.size === 0 &&
    selectedCharacters.size === 0 &&
    selectedCombos.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs sm:max-w-md p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose which games, characters, and combos to include in your
            export.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Select what to include in the export.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="text-xs h-7 px-2"
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectNone}
              className="text-xs h-7 px-2"
            >
              None
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[40vh] w-full border rounded-md">
          <div className="w-full p-2">
            {loading ? (
              <p className="text-sm text-muted-foreground p-2">Loading...</p>
            ) : data.games.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">
                No data to export.
              </p>
            ) : (
              data.games.map((game) => {
                const chars = charactersByGame.get(game.id) || [];
                const gameState = getGameCheckState(game.id);
                const isExpanded = expandedGames.has(game.id);

                return (
                  <div key={game.id}>
                    {/* Game row */}
                    <div className="flex min-w-0 items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1">
                      <button
                        type="button"
                        onClick={() => toggleExpandGame(game.id)}
                        className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {chars.length > 0 ? (
                          isExpanded ? (
                            <CaretDownIcon className="size-3.5" />
                          ) : (
                            <CaretRightIcon className="size-3.5" />
                          )
                        ) : (
                          <span className="size-3.5 inline-block" />
                        )}
                      </button>
                      <Checkbox
                        checked={gameState}
                        onCheckedChange={() => toggleGame(game.id)}
                      />
                      <span className="min-w-0 flex-1 truncate pr-2 text-sm font-medium">
                        {game.name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {chars.length} char{chars.length !== 1 && 's'}
                      </span>
                    </div>

                    {/* Characters */}
                    {isExpanded &&
                      chars.map((char) => {
                        const combos = combosByCharacter.get(char.id) || [];
                        const charState = getCharCheckState(char.id);
                        const isCharExpanded = expandedCharacters.has(char.id);

                        return (
                          <div key={char.id} className="ml-5">
                            {/* Character row */}
                            <div className="flex min-w-0 items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1">
                              <button
                                type="button"
                                onClick={() => toggleExpandCharacter(char.id)}
                                className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {combos.length > 0 ? (
                                  isCharExpanded ? (
                                    <CaretDownIcon className="size-3.5" />
                                  ) : (
                                    <CaretRightIcon className="size-3.5" />
                                  )
                                ) : (
                                  <span className="size-3.5 inline-block" />
                                )}
                              </button>
                              <Checkbox
                                checked={charState}
                                onCheckedChange={() =>
                                  toggleCharacter(char.id, game.id)
                                }
                              />
                              <span className="min-w-0 flex-1 truncate pr-2 text-sm">
                                {char.name}
                              </span>
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                {combos.length} combo
                                {combos.length !== 1 && 's'}
                              </span>
                            </div>

                            {/* Combos */}
                            {isCharExpanded &&
                              combos.map((combo) => (
                                <div
                                  key={combo.id}
                                  className="ml-5 flex min-w-0 items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1"
                                >
                                  <span className="size-3.5 inline-block shrink-0" />
                                  <Checkbox
                                    checked={selectedCombos.has(combo.id)}
                                    onCheckedChange={() =>
                                      toggleCombo(combo.id, char.id, game.id)
                                    }
                                  />
                                  <span className="min-w-0 flex-1 truncate pr-2 text-sm text-muted-foreground">
                                    {combo.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {hasLocalVideos && selectedVideoCount > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <Label htmlFor={includeVideosId} className="text-sm">
                Include demo videos
              </Label>
              <p className="text-xs text-muted-foreground">
                {selectedVideoCount} local video
                {selectedVideoCount !== 1 && 's'} — may increase file size
                significantly
              </p>
            </div>
            <Switch
              id={includeVideosId}
              checked={includeVideos}
              onCheckedChange={setIncludeVideos}
            />
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={nothingSelected}
          className="w-full"
        >
          {nothingSelected ? 'Select items to export' : 'Export'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
