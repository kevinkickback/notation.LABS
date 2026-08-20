import { PencilSimpleIcon, TrashIcon, UserIcon } from '@phosphor-icons/react';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
import { CoverImage } from '@/components/shared/CoverImage';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Game } from '@/lib/types';

interface GameGridCardProps {
  game: Game;
  charCount: number;
  isMobile: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: (gameId: string) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
  onToggleFavorite: () => void;
}

export function GameGridCard({
  game,
  charCount,
  isMobile,
  isSelecting,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
}: GameGridCardProps) {
  return (
    <Card
      className={`group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary overflow-hidden relative aspect-[3/4] !py-0 !gap-0 hover:scale-[1.03] ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect(game.id)}
    >
      {isSelecting && (
        <div className="absolute top-2 left-2 z-30">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(game.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 accent-primary cursor-pointer"
          />
        </div>
      )}
      {!isSelecting && (
        <div className="absolute top-1.5 left-1.5 z-30">
          <FavoriteButton
            entityName={game.name}
            isFavorite={Boolean(game.favorite)}
            onToggle={onToggleFavorite}
            revealOnGroupHover={!isMobile}
          />
        </div>
      )}
      <CoverImage
        src={game.logoImage || defaultGameImage}
        frameAspect={3 / 4}
        fit={game.coverFit}
        zoom={game.coverZoom}
        focalX={game.coverPanX}
        focalY={game.coverPanY}
        className="absolute inset-0"
      />
      <CardContent className="p-0 relative z-10 flex flex-col justify-end h-full">
        <div
          className="p-3 pt-16"
          style={{
            background:
              'linear-gradient(to top, black 0%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.35) 75%, transparent 100%)',
          }}
        >
          <h3
            className="font-bold text-white leading-tight mb-1"
            style={{
              fontSize: 'clamp(0.875rem, 1.1rem, 1.25rem)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {game.name}
          </h3>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" /> {charCount} characters
            </span>
          </div>
        </div>
        {!isSelecting && (
          <div
            className={`absolute top-1.5 right-1.5 flex gap-1 transition-opacity z-20 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${game.name}`}
              className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(game);
              }}
            >
              <PencilSimpleIcon className="w-4 h-4" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${game.name}`}
              className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(game);
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
