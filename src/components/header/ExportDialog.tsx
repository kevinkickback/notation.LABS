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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { loadBackupSelectionData } from '@/lib/application/backupCommands';
import type { BackupExportProgress } from '@/lib/backup/exportContract';
import { compareEntityNames } from '@/lib/entitySorting';
import { reportError } from '@/lib/errors';
import { getLocalVideoId } from '@/lib/storage/indexedDbStorage';
import {
  createExportSelection,
  getExportCheckState,
  getSelectedExportRecords,
  toggleExportNode,
} from './exportSelection';

interface ExportProgressModalProps extends BackupExportProgress {
  onCancel: () => void;
}
export function ExportProgressModal({
  current,
  total,
  phase,
  bytesWritten,
  onCancel,
  warning,
}: ExportProgressModalProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <Dialog open>
      <DialogContent
        className="max-w-[400px]"
        hideCloseButton
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Exporting library</DialogTitle>
          <DialogDescription>
            {phase === 'committing'
              ? 'Saving completed backup…'
              : phase === 'finalizing'
                ? 'Finishing backup…'
                : phase === 'preparing' || total === 0
                  ? total
                    ? `Preparing library: ${current} of ${total}…`
                    : 'Preparing export…'
                  : `Saving video ${Math.min(current + 1, total)} of ${total}…`}
          </DialogDescription>
        </DialogHeader>
        <output className="block space-y-3 py-2">
          <div
            role="progressbar"
            aria-label="Export progress"
            aria-valuemin={0}
            aria-valuemax={total || 1}
            aria-valuenow={current}
            className="h-2 bg-muted overflow-hidden rounded-sm"
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerGapIcon className="size-4 animate-spin" />
            <span>{(bytesWritten / 1024 / 1024).toFixed(1)} MB written</span>
          </div>
        </output>
        {warning && <p className="text-sm text-muted-foreground">{warning}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={phase === 'committing'}
          >
            Cancel export
          </Button>
        </DialogFooter>
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

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
}: ExportDialogProps) {
  const [selection, setSelection] = useState(() =>
    createExportSelection({
      games: [],
      characters: [],
      combos: [],
    }),
  );
  const { records: data, charactersByGame, combosByCharacter } = selection;
  const selectedRecords = useMemo(
    () => getSelectedExportRecords(selection),
    [selection],
  );
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
    let active = true;
    setLoading(true);
    setExpandedGames(new Set());
    setExpandedCharacters(new Set());
    setIncludeVideos(false);
    setHasLocalVideos(false);
    loadBackupSelectionData()
      .then(([games, characters, combos, videos]) => {
        if (!active) return;
        setSelection(createExportSelection({ games, characters, combos }));
        setHasLocalVideos(videos > 0);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        reportError('ExportDialog.loadData', err);
        setSelection(
          createExportSelection({ games: [], characters: [], combos: [] }),
        );
        setLoading(false);
        toast.error('Failed to load export data');
      });
    return () => {
      active = false;
    };
  }, [open]);

  const sortedGames = useMemo(
    () => [...data.games].sort(compareEntityNames),
    [data.games],
  );
  const selectedVideoCount = hasLocalVideos
    ? selectedRecords.combos.filter((combo) => !!getLocalVideoId(combo.demoUrl))
        .length
    : 0;

  const toggleExpandGame = (gameId: string) => {
    setExpandedGames((current) => {
      const next = new Set(current);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };
  const toggleExpandCharacter = (characterId: string) => {
    setExpandedCharacters((current) => {
      const next = new Set(current);
      if (next.has(characterId)) next.delete(characterId);
      else next.add(characterId);
      return next;
    });
  };

  const handleExport = () => {
    if (loading || selection.selected.size === 0) return;
    onExport(includeVideos, {
      gameIds: selectedRecords.games.map((game) => game.id),
      characterIds: selectedRecords.characters.map((character) => character.id),
      comboIds: selectedRecords.combos.map((combo) => combo.id),
    });
  };
  const nothingSelected = selection.selected.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[518px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription className="sr-only">
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
              onClick={() =>
                setSelection((current) => ({
                  ...current,
                  selected: new Set(current.leaves),
                }))
              }
              disabled={loading}
              className="text-xs h-7 px-2"
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelection((current) => ({ ...current, selected: new Set() }))
              }
              disabled={loading}
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
              sortedGames.map((game) => {
                const chars = charactersByGame.get(game.id) || [];
                const gameState = getExportCheckState(
                  selection,
                  'game',
                  game.id,
                );
                const isExpanded = expandedGames.has(game.id);

                return (
                  <div key={game.id}>
                    {/* Game row */}
                    <div className="flex min-w-0 items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1">
                      <button
                        type="button"
                        onClick={() => toggleExpandGame(game.id)}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${game.name}`}
                        aria-expanded={isExpanded}
                        disabled={chars.length === 0}
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
                        aria-label={`Include game ${game.name}`}
                        checked={gameState}
                        onCheckedChange={() =>
                          setSelection((current) =>
                            toggleExportNode(current, 'game', game.id),
                          )
                        }
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
                        const charState = getExportCheckState(
                          selection,
                          'character',
                          char.id,
                        );
                        const isCharExpanded = expandedCharacters.has(char.id);

                        return (
                          <div key={char.id} className="ml-5">
                            {/* Character row */}
                            <div className="flex min-w-0 items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1">
                              <button
                                type="button"
                                onClick={() => toggleExpandCharacter(char.id)}
                                aria-label={`${isCharExpanded ? 'Collapse' : 'Expand'} ${char.name}`}
                                aria-expanded={isCharExpanded}
                                disabled={combos.length === 0}
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
                                aria-label={`Include character ${char.name}`}
                                checked={charState}
                                onCheckedChange={() =>
                                  setSelection((current) =>
                                    toggleExportNode(
                                      current,
                                      'character',
                                      char.id,
                                    ),
                                  )
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
                                    aria-label={`Include combo ${combo.name}`}
                                    checked={getExportCheckState(
                                      selection,
                                      'combo',
                                      combo.id,
                                    )}
                                    onCheckedChange={() =>
                                      setSelection((current) =>
                                        toggleExportNode(
                                          current,
                                          'combo',
                                          combo.id,
                                        ),
                                      )
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
          disabled={loading || nothingSelected}
          className="w-full"
        >
          {nothingSelected ? 'Select items to export' : 'Export'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
