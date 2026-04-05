import defaultGameImage from '@/assets/images/defaultGame.jpg';
import type { Game } from '@/lib/types';

interface CharacterViewHeaderProps {
  game: Game;
}

export function CharacterViewHeader({ game }: CharacterViewHeaderProps) {
  return (
    <div className="min-w-0 flex-1 flex items-center gap-4">
      <div
        className="w-12 h-16 rounded-lg shrink-0 border border-border overflow-hidden"
        style={{
          backgroundImage: `url(${game.logoImage || defaultGameImage})`,
          backgroundSize: game.coverZoom ? `${game.coverZoom}%` : 'cover',
          backgroundPosition: game.coverZoom
            ? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%`
            : 'center',
          backgroundRepeat: 'no-repeat',
        }}
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
