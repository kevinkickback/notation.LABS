import type { Combo, Game, DisplayMode } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash, Pencil, DotsSixVertical, Play } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { parseComboNotation } from '@/lib/parser';
import { useSettings } from '@/hooks/useSettings';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableComboCardProps {
	combo: Combo;
	game: Game;
	displayMode: DisplayMode;
	onEdit: (combo: Combo) => void;
	onDelete: (id: string) => void;
	onTagClick: (tag: string) => void;
	onWatchDemo: (combo: Combo) => void;
	isDragDisabled: boolean;
	isSelecting: boolean;
	isSelected: boolean;
	onToggleSelect: (id: string) => void;
}

export function SortableComboCard({
	combo,
	game,
	displayMode,
	onEdit,
	onDelete,
	onTagClick,
	onWatchDemo,
	isDragDisabled,
	isSelecting,
	isSelected,
	onToggleSelect,
}: SortableComboCardProps) {
	const settings = useSettings();
	const comboScale = settings.comboScale ?? 1;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: combo.id, disabled: isDragDisabled });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
		>
			<CardContent className="px-3 py-2">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-start gap-2 flex-1">
						{isSelecting && (
							<input
								type="checkbox"
								checked={isSelected}
								onChange={() => onToggleSelect(combo.id)}
								className="mt-1.5 w-4 h-4 accent-primary cursor-pointer"
							/>
						)}
						{!isDragDisabled && !isSelecting && (
							<button
								{...attributes}
								{...listeners}
								className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
								tabIndex={-1}
							>
								<DotsSixVertical className="w-5 h-5" />
							</button>
						)}
						<div className="flex-1">
							<div
								className="flex items-center gap-2 flex-wrap"
								style={{ fontSize: `${comboScale}rem` }}
							>
								<h3
									className="font-semibold"
									style={{ fontSize: `${1 * comboScale}rem` }}
								>
									{combo.name}
								</h3>
								{combo.difficulty && (
									<Badge variant="secondary" className="text-sm py-0">
										Difficulty: {combo.difficulty}/5
									</Badge>
								)}
								{combo.damage && (
									<Badge variant="secondary" className="text-sm py-0">
										{combo.damage} dmg
									</Badge>
								)}
								{combo.meterCost && (
									<Badge variant="secondary" className="text-sm py-0">
										{combo.meterCost}
									</Badge>
								)}
								{combo.tags.map((tag) => (
									<Badge
										key={tag}
										variant="outline"
										className="text-sm py-0 cursor-pointer hover:bg-primary/20 transition-colors"
										onClick={(e) => {
											e.stopPropagation();
											onTagClick(tag);
										}}
									>
										#{tag}
									</Badge>
								))}
							</div>
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						{combo.demoUrl && (
							<Button
								variant="ghost"
								size="sm"
								className="h-9 px-3 gap-2 text-primary hover:text-primary"
								onClick={() => onWatchDemo(combo)}
							>
								<Play className="size-5" weight="fill" />
								<span className="text-sm font-medium">Watch Demo</span>
							</Button>
						)}
						{combo.demoUrl && (
							<Separator orientation="vertical" className="!h-6 mx-1" />
						)}
						<Button
							variant="ghost"
							size="icon"
							className="size-10 text-muted-foreground hover:text-foreground"
							onClick={() => onEdit(combo)}
						>
							<Pencil className="size-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-10 text-destructive hover:text-destructive"
							onClick={() => onDelete(combo.id)}
						>
							<Trash className="size-5" />
						</Button>
					</div>
				</div>

				<div className="bg-card border border-border rounded-md p-3">
					<ComboDisplay
						tokens={parseComboNotation(combo.notation, game.buttonLayout)}
						mode={displayMode}
						game={game}
					/>
				</div>

				{combo.description && (
					<p className="text-sm text-muted-foreground mt-2">
						{combo.description}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
