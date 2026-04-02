import { PencilSimple, Trash, User, GameController, Timer } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Game } from '@/lib/types';

interface GameListCardProps {
    game: Game;
    charCount: number;
    comboCount: number;
    lastModified: number;
    isMobile: boolean;
    onSelect: (gameId: string) => void;
    onEdit: (game: Game) => void;
    onDelete: (game: Game) => void;
}

export function GameListCard({
    game,
    charCount,
    comboCount,
    lastModified,
    isMobile,
    onSelect,
    onEdit,
    onDelete,
}: GameListCardProps) {
    return (
        <Card
            className="group cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary overflow-hidden h-[72px] !py-0 !gap-0"
            onClick={() => onSelect(game.id)}
        >
            <CardContent
                className={`p-0 flex items-center h-full${isMobile ? ' relative' : ''}`}
            >
                <div
                    className={`flex items-center flex-1 pl-4 ${isMobile ? 'gap-2 pr-16' : 'gap-6 pr-2'}`}
                    style={isMobile ? { minWidth: 0 } : undefined}
                >
                    <h3 className="font-bold text-white text-base min-w-[120px] truncate max-w-[40vw]">
                        {game.name}
                    </h3>
                    {!isMobile ? (
                        <>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
                                <User className="w-3.5 h-3.5" /> {charCount} characters
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
                                <GameController className="w-3.5 h-3.5" /> {comboCount} combos
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
                                <Timer className="w-3.5 h-3.5" />{' '}
                                {new Date(lastModified).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </p>
                        </>
                    ) : (
                        game.name.length < 16 && (
                            <>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
                                    <User className="w-3.5 h-3.5" /> {charCount}
                                </p>
                                {game.name.length < 10 && (
                                    <>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
                                            <GameController className="w-3.5 h-3.5" />{' '}
                                            {comboCount}
                                        </p>
                                        {game.name.length < 8 && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 max-w-[22vw] truncate">
                                                <Timer className="w-3.5 h-3.5" />{' '}
                                                {new Date(lastModified).toLocaleDateString(
                                                    undefined,
                                                    {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    },
                                                )}
                                            </p>
                                        )}
                                    </>
                                )}
                            </>
                        )
                    )}
                </div>
                <div
                    className={`flex gap-1 pr-3 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'} ${isMobile ? 'absolute right-2 top-1/2 -translate-y-1/2 z-10' : ''}`}
                    style={isMobile ? { height: 'auto', background: 'none' } : undefined}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(game);
                        }}
                    >
                        <PencilSimple className="w-4 h-4" weight="bold" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(game);
                        }}
                    >
                        <Trash className="w-4 h-4" weight="bold" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
