import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import type { Character, Game } from '@/lib/types';

interface ComboViewHeaderProps {
  character: Character;
  game: Game;
  comboCount: number;
}

export function ComboViewHeader({
  character,
  game,
  comboCount,
}: ComboViewHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
      <div className="min-w-0 flex-1 flex items-center gap-4">
        <div
          className="w-20 h-14 rounded-lg shrink-0 border border-border overflow-hidden"
          style={{
            backgroundImage: `url(${character.portraitImage || defaultCharacterImage})`,
            backgroundSize: character.portraitZoom
              ? `${character.portraitZoom}%`
              : 'cover',
            backgroundPosition: character.portraitZoom
              ? `${character.portraitPanX ?? 50}% ${character.portraitPanY ?? 50}%`
              : 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="min-w-0">
          <h2 className="text-3xl font-bold mb-1 truncate">{character.name}</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <span>{game.name}</span>
            <span className="text-border">|</span>
            <span>{comboCount} combos</span>
          </p>
        </div>
      </div>
    </div>
  );
}
