import type { Character } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PencilSimpleIcon,
  TrashIcon,
  GameControllerIcon,
  TimerIcon,
} from '@phosphor-icons/react';

interface CharacterListCardProps {
  character: Character;
  comboCount: number;
  lastModified: number;
  isMobile: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CharacterListCard({
  character,
  comboCount,
  lastModified,
  isMobile,
  isSelecting,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: CharacterListCardProps) {
  return (
    <Card
      className={`group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden h-[72px] !py-0 !gap-0 ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
    >
      <CardContent
        className={`p-0 flex items-center h-full${isMobile ? ' relative' : ''}`}
      >
        {isSelecting && (
          <div className="pl-3 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>
        )}
        <div
          className={`flex items-center flex-1 ${isSelecting ? 'pl-2' : 'pl-4'} ${isMobile ? 'gap-2 pr-16' : 'gap-6 pr-2'}`}
          style={isMobile ? { minWidth: 0 } : undefined}
        >
          <h3 className="font-bold text-white text-base min-w-[120px] truncate max-w-[40vw]">
            {character.name}
          </h3>
          {!isMobile ? (
            <>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
                <GameControllerIcon className="w-3.5 h-3.5" /> {comboCount}{' '}
                combos
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
                <TimerIcon className="w-3.5 h-3.5" />{' '}
                {new Date(lastModified).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </>
          ) : (
            <>
              {character.name.length < 16 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
                  <GameControllerIcon className="w-3.5 h-3.5" /> {comboCount}
                </p>
              )}
              {character.name.length < 10 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
                  <TimerIcon className="w-3.5 h-3.5" />{' '}
                  {new Date(lastModified).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </>
          )}
        </div>
        {!isSelecting && (
          <div
            className={`flex gap-1 pr-3 ${isMobile ? 'opacity-100 absolute right-2 top-1/2 -translate-y-1/2 z-10' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
            style={
              isMobile ? { height: 'auto', background: 'none' } : undefined
            }
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <PencilSimpleIcon className="w-4 h-4" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <TrashIcon className="w-4 h-4" weight="bold" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
