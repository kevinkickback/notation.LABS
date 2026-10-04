import { ArrowClockwiseIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { getGames, updateGame } from '@/lib/application/gameCommands';
import { DEFAULT_BUTTON_PALETTE, DEFAULT_SETTINGS } from '@/lib/defaults';
import { notify } from '@/lib/notifications';
import type { Game, NotationColors } from '@/lib/types';

const DEFAULT_COLORS: NotationColors = DEFAULT_SETTINGS.notationColors;

export function ColorCustomization({
  onUnsavedChangesChange,
}: {
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}) {
  const settings = useSettings();
  const { setSetting } = useSettingsActions();
  const [tempColors, setTempColors] = useState<NotationColors>(
    settings.notationColors,
  );
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [tempButtonColors, setTempButtonColors] = useState<
    Record<string, string>
  >({});
  const [tempButtonLayout, setTempButtonLayout] = useState<string[]>([]);
  const [newButtonName, setNewButtonName] = useState('');
  const [separatorHex, setSeparatorHex] = useState<string>();
  const [hexEdits, setHexEdits] = useState<Record<string, string>>({});

  const refreshGames = useCallback(async () => {
    const allGames = await getGames();
    const sorted = allGames
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    setGames(sorted);
    return sorted;
  }, []);

  // Derive selectedGame directly from state
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const hasChanges =
    Object.entries(tempColors).some(
      ([key, color]) => color !== settings.notationColors[key],
    ) ||
    !!(
      selectedGame &&
      (tempButtonLayout.length !== selectedGame.buttonLayout.length ||
        tempButtonLayout.some(
          (button, index) =>
            button !== selectedGame.buttonLayout[index] ||
            tempButtonColors[button] !== selectedGame.buttonColors?.[button],
        ))
    );
  useEffect(() => {
    onUnsavedChangesChange(hasChanges);
    return () => onUnsavedChangesChange(false);
  }, [hasChanges, onUnsavedChangesChange]);

  useEffect(() => {
    refreshGames().then((sorted) => {
      if (sorted.length > 0) setSelectedGameId(sorted[0].id);
    });
  }, [refreshGames]);

  useEffect(() => {
    const game = games.find((g) => g.id === selectedGameId);
    setTempButtonColors(game?.buttonColors || {});
    setTempButtonLayout(game?.buttonLayout ? [...game.buttonLayout] : []);
    setNewButtonName('');
    setHexEdits({});
  }, [selectedGameId, games]);

  const handleColorChange = (key: keyof NotationColors, value: string) => {
    setTempColors((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleButtonColorChange = (button: string, value: string) => {
    setTempButtonColors((prev) => ({
      ...prev,
      [button]: value,
    }));
  };

  const handleApply = async () => {
    if (!(await setSetting('notationColors', tempColors))) return;

    if (selectedGameId && selectedGame) {
      await updateGame(selectedGameId, {
        buttonLayout: tempButtonLayout,
        buttonColors: tempButtonColors,
      });
      await refreshGames();
    }

    notify.success('Colors updated successfully');
  };

  const handleReset = async () => {
    setTempColors(DEFAULT_COLORS);
    setSeparatorHex(undefined);
    if (!(await setSetting('notationColors', DEFAULT_COLORS))) return;

    if (selectedGameId && selectedGame) {
      const defaultLayout = [...selectedGame.buttonLayout];
      const defaultButtonColors = defaultLayout.reduce(
        (acc, btn, idx) => {
          acc[btn] =
            DEFAULT_BUTTON_PALETTE[idx % DEFAULT_BUTTON_PALETTE.length];
          return acc;
        },
        {} as Record<string, string>,
      );

      setTempButtonLayout(defaultLayout);
      setTempButtonColors(defaultButtonColors);
      await updateGame(selectedGameId, {
        buttonLayout: defaultLayout,
        buttonColors: defaultButtonColors,
      });
      setHexEdits({});
      await refreshGames();
    }

    notify.success('Colors reset to defaults');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Separators</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Color for &gt;, ~, and other combo separators.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative w-20 h-10 rounded-md border border-border shadow-sm cursor-pointer overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: tempColors.separator }}
                />
                <input
                  type="color"
                  aria-label="Separator color"
                  value={tempColors.separator}
                  onChange={(e) => {
                    handleColorChange('separator', e.target.value);
                    setSeparatorHex(e.target.value);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              {(() => {
                const currentHex = tempColors.separator;
                return (
                  <input
                    type="text"
                    aria-label="Separator color hex"
                    value={separatorHex ?? currentHex}
                    onChange={(e) => setSeparatorHex(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      let val = e.target.value.trim();
                      if (!val.startsWith('#')) val = `#${val}`;
                      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                        handleColorChange('separator', val);
                        setSeparatorHex(val);
                      } else {
                        setSeparatorHex(currentHex);
                      }
                    }}
                    className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
                  />
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Select Game
            </Label>
            <Select value={selectedGameId} onValueChange={setSelectedGameId}>
              <SelectTrigger aria-label="Select Game">
                <SelectValue placeholder="Choose a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedGame && (
            <div className="grid gap-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Button colors also apply to paired motions and modifiers.
              </p>
              {tempButtonLayout.map((button) => {
                const currentHex = tempButtonColors[button] || '#3b82f6';
                const editHex = hexEdits[button] ?? currentHex;
                return (
                  <div key={button} className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {button} Button
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="relative w-20 h-10 rounded-md border border-border shadow-sm cursor-pointer overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{ backgroundColor: currentHex }}
                        />
                        <input
                          type="color"
                          aria-label={`${button} button color`}
                          value={currentHex}
                          onChange={(e) => {
                            handleButtonColorChange(button, e.target.value);
                            setHexEdits((prev) => ({
                              ...prev,
                              [button]: e.target.value,
                            }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </label>
                      <input
                        type="text"
                        aria-label={`${button} button color hex`}
                        value={editHex}
                        onChange={(e) =>
                          setHexEdits((prev) => ({
                            ...prev,
                            [button]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={(e) => {
                          let val = e.target.value.trim();
                          if (!val.startsWith('#')) val = `#${val}`;
                          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                            handleButtonColorChange(button, val);
                            setHexEdits((prev) => ({ ...prev, [button]: val }));
                          } else {
                            setHexEdits((prev) => ({
                              ...prev,
                              [button]: currentHex,
                            }));
                          }
                        }}
                        className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remove ${button} button`}
                      onClick={() =>
                        setTempButtonLayout((prev) =>
                          prev.filter((b) => b !== button),
                        )
                      }
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-3 border-t border-border">
                <Input
                  placeholder="Button name (e.g. LP)"
                  value={newButtonName}
                  onChange={(e) => setNewButtonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = newButtonName.trim();
                      if (name && !tempButtonLayout.includes(name)) {
                        const i = tempButtonLayout.length;
                        setTempButtonLayout((prev) => [...prev, name]);
                        setTempButtonColors((prev) => ({
                          ...prev,
                          [name]:
                            DEFAULT_BUTTON_PALETTE[
                              i % DEFAULT_BUTTON_PALETTE.length
                            ],
                        }));
                        setNewButtonName('');
                      }
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const name = newButtonName.trim();
                    if (name && !tempButtonLayout.includes(name)) {
                      const i = tempButtonLayout.length;
                      setTempButtonLayout((prev) => [...prev, name]);
                      setTempButtonColors((prev) => ({
                        ...prev,
                        [name]:
                          DEFAULT_BUTTON_PALETTE[
                            i % DEFAULT_BUTTON_PALETTE.length
                          ],
                      }));
                      setNewButtonName('');
                    }
                  }}
                >
                  <PlusIcon className="w-4 h-4 mr-1" weight="bold" />
                  Add
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button onClick={handleApply} className="flex-1">
              Apply Changes
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowClockwiseIcon className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
