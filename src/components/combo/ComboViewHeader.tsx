import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import { CoverImage } from '@/components/shared/CoverImage';
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
        <CoverImage
          src={character.portraitImage || defaultCharacterImage}
          frameAspect={10 / 7}
          fit={character.portraitFit}
          zoom={character.portraitZoom}
          focalX={character.portraitPanX}
          focalY={character.portraitPanY}
          className="w-20 h-14 rounded-lg shrink-0 border border-border overflow-hidden"
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
