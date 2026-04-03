import { GameControllerIcon, PlusIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface GameLibraryEmptyStateProps {
  onAddGame: () => void;
}

export function GameLibraryEmptyState({
  onAddGame,
}: GameLibraryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        <GameControllerIcon className="w-12 h-12 text-primary" />
      </div>

      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold mb-2">No Games Yet</h2>
        <p className="text-muted-foreground mb-6">
          Start tracking combos by adding your first fighting game
        </p>
        <Button onClick={onAddGame} size="lg" className="gap-2">
          <PlusIcon weight="bold" />
          Add Your First Game
        </Button>
      </div>
    </div>
  );
}
