import type { Character } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PencilSimple, Trash, GameController } from '@phosphor-icons/react';
import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';

interface CharacterGridCardProps {
    character: Character;
    comboCount: number;
    isMobile: boolean;
    isSelecting: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function CharacterGridCard({
    character,
    comboCount,
    isMobile,
    isSelecting,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
}: CharacterGridCardProps) {
    return (
        <Card
            className={`group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden relative aspect-[4/3] !py-0 !gap-0 hover:scale-[1.03] ${isSelected ? 'ring-2 ring-primary' : ''}`}
            onClick={onSelect}
        >
            {isSelecting && (
                <div className="absolute top-2 left-2 z-30">
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
                className="absolute inset-0"
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
            <CardContent className="p-0 relative z-10 flex flex-col justify-end h-full">
                <div
                    className="p-3 pt-16"
                    style={{
                        background:
                            'linear-gradient(to top, black 0%, rgba(0,0,0,0.97) 25%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.2) 85%, transparent 100%)',
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
                        {character.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <span className="flex items-center gap-1">
                            <GameController className="w-3.5 h-3.5" /> {comboCount} combos
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
                            className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                        >
                            <PencilSimple className="w-4 h-4" weight="bold" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <Trash className="w-4 h-4" weight="bold" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
