interface GameLibraryHeaderProps {
  gameCount: number;
}

export function GameLibraryHeader({ gameCount }: GameLibraryHeaderProps) {
  return (
    <div className="min-w-0">
      <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3 truncate">
        Game Library
        <span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold px-2.5 py-0.5 tabular-nums">
          {gameCount}
        </span>
      </h2>
      <p className="text-muted-foreground truncate">
        Select a game to manage characters and combos
      </p>
    </div>
  );
}
