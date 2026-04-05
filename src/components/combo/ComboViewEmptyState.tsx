import { LightningIcon, PlusIcon } from '@phosphor-icons/react';
import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import { Button } from '@/components/ui/button';
import type { Character, Game } from '@/lib/types';

interface ComboViewEmptyStateProps {
  game: Game;
  character: Character;
  onAddCombo: () => void;
}

export function ComboViewEmptyState({
  game,
  character,
  onAddCombo,
}: ComboViewEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        <LightningIcon className="w-12 h-12 text-primary" />
      </div>

      <div className="text-center max-w-md">
        <div
          className="w-32 h-24 rounded-xl mx-auto mb-4 border-2 border-border overflow-hidden"
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
        <h2 className="text-3xl font-bold mb-2">{character.name}</h2>
        <p className="text-sm text-muted-foreground mb-6">{game.name}</p>
        <p className="text-muted-foreground mb-6">
          No combos yet. Add your first combo for this character.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={onAddCombo} size="lg" className="gap-2">
            <PlusIcon weight="bold" />
            Add Combo
          </Button>
        </div>
      </div>
    </div>
  );
}
