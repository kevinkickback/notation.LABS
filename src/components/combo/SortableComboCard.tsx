import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CopyIcon,
  DotsSixVerticalIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Combo, DisplayMode, Game } from '@/lib/types';

interface SortableComboCardProps {
  combo: Combo;
  game: Game;
  displayMode: DisplayMode;
  onEdit: (combo: Combo) => void;
  onDuplicate: (combo: Combo) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onWatchDemo: (combo: Combo) => void;
  isDragDisabled: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export function SortableComboCard({
  combo,
  game,
  displayMode,
  onEdit,
  onDuplicate,
  onDelete,
  onTagClick,
  onWatchDemo,
  isDragDisabled,
  isSelecting,
  isSelected,
  onToggleSelect,
}: SortableComboCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: combo.id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''} ${combo.outdated ? 'border-l-4 border-l-amber-500' : ''}`}
    >
      <CardContent className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          {isSelecting && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(combo.id)}
              className="w-4 h-4 accent-primary cursor-pointer shrink-0"
            />
          )}
          {!isSelecting && (
            <button
              {...(!isDragDisabled ? attributes : {})}
              {...(!isDragDisabled ? listeners : {})}
              className={`touch-none shrink-0 ${
                isDragDisabled
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-grab active:cursor-grabbing hover:text-foreground'
              } text-muted-foreground`}
              tabIndex={isDragDisabled ? -1 : -1}
              disabled={isDragDisabled}
              title={
                isDragDisabled
                  ? 'Drag disabled while filters are active'
                  : 'Drag to reorder'
              }
            >
              <DotsSixVerticalIcon className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5">
              <h3 className="font-semibold text-xl leading-none text-center sm:text-left shrink-0">
                {combo.name}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                {combo.outdated && (
                  <Badge className="text-sm py-0.5 px-2.5 rounded-md gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/60">
                    <WarningIcon className="w-3 h-3" weight="fill" />
                    Outdated
                  </Badge>
                )}
                {combo.difficulty && (
                  <Badge className="text-sm py-0.5 px-2.5 rounded-md bg-yellow-400/15 text-yellow-300 border border-yellow-400/50">
                    Difficulty: {combo.difficulty}/5
                  </Badge>
                )}
                {combo.damage && (
                  <Badge className="text-sm py-0.5 px-2.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/50">
                    {combo.damage} dmg
                  </Badge>
                )}
                {combo.meterCost && (
                  <Badge className="text-sm py-0.5 px-2.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/50">
                    {combo.meterCost}
                  </Badge>
                )}
                {combo.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="text-sm py-0.5 px-3 rounded-md cursor-pointer transition-colors bg-primary/10 text-primary border border-primary/40 hover:bg-primary/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick(tag);
                    }}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>{' '}
            </div>{' '}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {combo.demoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 gap-2 text-primary hover:text-primary"
                onClick={() => onWatchDemo(combo)}
              >
                <PlayIcon className="size-5" weight="fill" />
                <span className="text-sm font-medium">Watch Demo</span>
              </Button>
            )}
            {combo.demoUrl && (
              <Separator orientation="vertical" className="!h-6 mx-1" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(combo)}
            >
              <PencilIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(combo)}
            >
              <CopyIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-destructive hover:text-destructive"
              onClick={() => onDelete(combo.id)}
            >
              <TrashIcon className="size-5" />
            </Button>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
          <ComboDisplay
            tokens={combo.parsedNotation}
            mode={displayMode}
            game={game}
          />
          {combo.description && (
            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/50">
              {combo.description}
            </p>
          )}
        </div>

        <div className="flex sm:hidden items-center justify-between mt-1.5">
          <div>
            {combo.demoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 gap-2 text-primary hover:text-primary"
                onClick={() => onWatchDemo(combo)}
              >
                <PlayIcon className="size-5" weight="fill" />
                <span className="text-sm font-medium">Watch Demo</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(combo)}
            >
              <PencilIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(combo)}
            >
              <CopyIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-destructive hover:text-destructive"
              onClick={() => onDelete(combo.id)}
            >
              <TrashIcon className="size-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
