import { PlusIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ColorPickerRow } from '@/components/ui/ColorPickerRow';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Game } from '@/lib/types';

const DEFAULT_BTN_PALETTE = [
  '#e53e3e',
  '#dd6b20',
  '#d69e2e',
  '#38a169',
  '#319795',
  '#3182ce',
  '#5a67d8',
  '#805ad5',
  '#d53f8c',
  '#718096',
];

interface ButtonColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
}

export function ButtonColorDialog({
  open,
  onOpenChange,
  game,
}: ButtonColorDialogProps) {
  const [tempButtonLayout, setTempButtonLayout] = useState<string[]>([]);
  const [tempGameColors, setTempGameColors] = useState<Record<string, string>>(
    {},
  );
  const [newButtonName, setNewButtonName] = useState('');

  useEffect(() => {
    if (open) {
      const layout = [...game.buttonLayout];
      const initial: Record<string, string> = {};
      layout.forEach((btn, i) => {
        initial[btn] =
          game.buttonColors?.[btn] ||
          DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length];
      });
      setTempButtonLayout(layout);
      setTempGameColors(initial);
      setNewButtonName('');
    }
  }, [open, game]);

  const handleSave = async () => {
    try {
      const colorsToSave: Record<string, string> = {};
      tempButtonLayout.forEach((btn, i) => {
        colorsToSave[btn] =
          tempGameColors[btn] ||
          DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length];
      });
      await indexedDbStorage.games.update(game.id, {
        buttonLayout: tempButtonLayout,
        buttonColors: colorsToSave,
      });
      toast.success('Button colors updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update colors');
    }
  };

  const addButton = () => {
    const name = newButtonName.trim();
    if (name && !tempButtonLayout.includes(name)) {
      const i = tempButtonLayout.length;
      setTempButtonLayout((prev) => [...prev, name]);
      setTempGameColors((prev) => ({
        ...prev,
        [name]: DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length],
      }));
      setNewButtonName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border pb-4 pr-6">
          <DialogTitle>Button Colors — {game.name}</DialogTitle>
        </DialogHeader>
        <DialogBody className="-mr-2 pr-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
            {tempButtonLayout.map((btn) => (
              <ColorPickerRow
                key={btn}
                label={btn}
                value={tempGameColors[btn] || '#808080'}
                onChange={(hex) =>
                  setTempGameColors((prev) => ({ ...prev, [btn]: hex }))
                }
                onRemove={() =>
                  setTempButtonLayout((prev) => prev.filter((b) => b !== btn))
                }
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Input
              placeholder="Button name (e.g. LP)"
              value={newButtonName}
              onChange={(e) => setNewButtonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addButton();
              }}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={addButton}
            >
              <PlusIcon className="w-4 h-4 mr-1" weight="bold" />
              Add
            </Button>
          </div>
        </DialogBody>
        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
