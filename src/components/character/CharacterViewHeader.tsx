import defaultGameImage from '@/assets/images/defaultGame.jpg';
import { CoverImage } from '@/components/shared/CoverImage';
import type { Game } from '@/lib/types';

interface CharacterViewHeaderProps {
  game: Game;
}

export function CharacterViewHeader({ game }: CharacterViewHeaderProps) {
  return (
    <div className="min-w-0 flex-1 flex items-center gap-4">
      <CoverImage
        src={game.logoImage || defaultGameImage}
        frameAspect={3 / 4}
        fit={game.coverFit}
        zoom={game.coverZoom}
        focalX={game.coverPanX}
        focalY={game.coverPanY}
        className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-border"
      />
      <div className="min-w-0">
        <h2 className="text-3xl font-bold mb-1 truncate">{game.name}</h2>
        <p className="text-muted-foreground">
          Select a character to manage combos
        </p>
      </div>
    </div>
  );
}
