import { PlusIcon, UserIcon } from '@phosphor-icons/react';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
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
        <div
          className="w-20 h-28 rounded-xl mx-auto mb-4 border-2 border-border overflow-hidden"
          style={{
            backgroundImage: `url(${game.logoImage || defaultGameImage})`,
            backgroundSize: game.coverZoom ? `${game.coverZoom}%` : 'cover',
            backgroundPosition: game.coverZoom
              ? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%`
              : 'center',
            backgroundRepeat: 'no-repeat',
          }}
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
