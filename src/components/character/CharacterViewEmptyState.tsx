import { PlusIcon, UserIcon } from '@phosphor-icons/react';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
import { CoverImage } from '@/components/shared/CoverImage';
import { Button } from '@/components/ui/button';
import type { Game } from '@/lib/types';

interface CharacterViewEmptyStateProps {
  game: Game;
  onAddCharacter: () => void;
}

export function CharacterViewEmptyState({
  game,
  onAddCharacter,
}: CharacterViewEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
        <UserIcon className="w-12 h-12 text-accent" />
      </div>

      <div className="text-center max-w-md">
        <CoverImage
          src={game.logoImage || defaultGameImage}
          frameAspect={3 / 4}
          fit={game.coverFit}
          zoom={game.coverZoom}
          focalX={game.coverPanX}
          focalY={game.coverPanY}
          className="mx-auto mb-4 aspect-[3/4] w-20 overflow-hidden rounded-xl border-2 border-border"
        />
        <h2 className="text-3xl font-bold mb-2">{game.name}</h2>
        <p className="text-muted-foreground mb-6">
          No characters added yet. Add your first character to start tracking
          combos.
        </p>
        <Button onClick={onAddCharacter} size="lg" className="gap-2">
          <PlusIcon weight="bold" />
          Add Character
        </Button>
      </div>
    </div>
  );
}
