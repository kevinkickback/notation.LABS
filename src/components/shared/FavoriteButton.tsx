import { StarIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  entityName: string;
  isFavorite: boolean;
  onToggle: () => void;
  revealOnGroupHover?: boolean;
  className?: string;
}

export function FavoriteButton({
  entityName,
  isFavorite,
  onToggle,
  revealOnGroupHover = false,
  className,
}: FavoriteButtonProps) {
  const action = isFavorite ? 'Remove from favorites' : 'Add to favorites';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${action}: ${entityName}`}
      aria-pressed={isFavorite}
      title={action}
      className={cn(
        'h-7 w-7 bg-black/70 hover:!bg-yellow-500/25 cursor-pointer',
        isFavorite
          ? 'text-yellow-300 hover:text-yellow-200'
          : 'text-gray-200 hover:text-yellow-200',
        revealOnGroupHover &&
          !isFavorite &&
          'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
        if (revealOnGroupHover && event.detail > 0) {
          event.currentTarget.blur();
        }
      }}
    >
      <StarIcon className="w-4 h-4" weight={isFavorite ? 'fill' : 'regular'} />
    </Button>
  );
}
