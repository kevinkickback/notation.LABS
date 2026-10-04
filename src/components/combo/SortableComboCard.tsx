import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CopyIcon,
  DotsSixVerticalIcon,
  GaugeIcon,
  PencilIcon,
  PlayIcon,
  StarFourIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { NotesMarkdown } from '@/components/shared/NotesMarkdown';
import { Button } from '@/components/ui/button';
import { getTagTone, uniqueTags } from '@/lib/tags';
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
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: combo.id, disabled: isDragDisabled || isSelecting });
  const tags = uniqueTags(combo.tags);
  const hasDetails = !!(
    combo.difficulty ||
    combo.damage ||
    combo.meterCost ||
    tags.length
  );
  return (
    <article
      ref={setNodeRef}
      aria-label={combo.name}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`combo-card ${isSelected ? 'is-selected' : ''} ${combo.outdated ? 'is-outdated' : ''}`}
    >
      <div className="combo-card-heading">
        {isSelecting ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(combo.id)}
            aria-label={`Select ${combo.name}`}
            className="combo-card-handle combo-card-checkbox"
          />
        ) : (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            disabled={isDragDisabled}
            aria-label={`Reorder ${combo.name}`}
            title={
              isDragDisabled
                ? 'Drag disabled while filters are active'
                : 'Drag, or press Space and use arrow keys to reorder'
            }
            className="combo-card-handle combo-card-grip"
          >
            <DotsSixVerticalIcon className="size-5" />
          </button>
        )}
        <div className="combo-card-summary">
          <h3 className="combo-card-title">{combo.name}</h3>
          {combo.outdated && (
            <span className="combo-card-outdated">
              <WarningIcon className="size-3.5" />
              Outdated
            </span>
          )}
        </div>
        <div className="combo-card-actions">
          {combo.demoUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="combo-card-demo"
              aria-label="Watch Demo"
              onClick={() => onWatchDemo(combo)}
            >
              <PlayIcon className="size-4" weight="fill" />
              <span>Demo</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="combo-card-action"
            aria-label="Edit combo"
            title="Edit combo"
            onClick={() => onEdit(combo)}
          >
            <PencilIcon className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="combo-card-action"
            aria-label="Duplicate combo"
            title="Duplicate combo"
            onClick={() => onDuplicate(combo)}
          >
            <CopyIcon className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="combo-card-action combo-card-delete"
            aria-label="Delete combo"
            title="Delete combo"
            onClick={() => onDelete(combo.id)}
          >
            <TrashIcon className="size-[18px]" />
          </Button>
        </div>
      </div>
      <div className="combo-card-notation">
        <ComboDisplay
          tokens={combo.parsedNotation}
          mode={displayMode}
          game={game}
        />
      </div>
      {combo.description && (
        <div className="combo-card-notes">
          <NotesMarkdown content={combo.description} />
        </div>
      )}
      {hasDetails && (
        <div className="combo-card-metadata">
          <div className="combo-card-stats">
            {combo.damage && (
              <span className="combo-card-stat">
                <StarFourIcon
                  className="combo-card-stat-icon"
                  aria-hidden="true"
                />
                <span>
                  <strong>{combo.damage}</strong> damage
                </span>
              </span>
            )}
            {combo.meterCost && (
              <span className="combo-card-stat">
                <GaugeIcon
                  className="combo-card-stat-icon"
                  aria-hidden="true"
                />
                <span>{combo.meterCost}</span>
              </span>
            )}
            {combo.difficulty && (
              <span
                className="combo-card-difficulty"
                data-difficulty={combo.difficulty}
              >
                <span>Difficulty:</span>{' '}
                <span className="combo-card-difficulty-bars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <i
                      key={level}
                      data-active={level <= (combo.difficulty ?? 0)}
                    />
                  ))}
                </span>
                <strong>{combo.difficulty}/5</strong>
              </span>
            )}
          </div>
          <div className="combo-card-tags">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag}
                className="combo-tag"
                data-tone={getTagTone(tag)}
                onClick={() => onTagClick(tag)}
                aria-label={`Filter by ${tag}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
