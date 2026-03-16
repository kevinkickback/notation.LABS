import type { Game, Character } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	Plus,
	User,
	Funnel,
	X,
	ImageSquare,
	Trash,
	PencilSimple,
	Timer,
	GameController,
	SquaresFour,
	List,
	MagnifyingGlass,
} from '@phosphor-icons/react';
import defaultCharacterImage from '@/assets/images/defaultCharacter.jpg';
import { CharacterImageSearchDialog } from './CharacterImageSearchDialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState, useMemo, useEffect, useId } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { indexedDbStorage, db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

type CharacterSort = 'name-asc' | 'name-desc' | 'combos' | 'modified';

interface CharacterViewProps {
	game: Game;
	characters: Character[];
}

export function CharacterView({ game, characters }: CharacterViewProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Character | null>(null);
	const [name, setName] = useState('');
	const [notes, setNotes] = useState('');
	const [portraitImage, setPortraitImage] = useState('');
	const [portraitZoom, setPortraitZoom] = useState(100);
	const [portraitPanX, setPortraitPanX] = useState(50);
	const [portraitPanY, setPortraitPanY] = useState(50);
	const { setSelectedCharacter } = useAppStore();

	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<CharacterSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');
	const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const settings = useSettings();
	const [cardSize, setCardSize] = useState(settings.characterCardSize);
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		setCardSize(settings.characterCardSize);
	}, [settings.characterCardSize]);
	/* eslint-enable react-hooks/set-state-in-effect */
	const charNameId = useId();
	const charNotesId = useId();
	const [imageSearchOpen, setImageSearchOpen] = useState(false);

	// Get combo counts per character
	const combos = useLiveQuery(
		() =>
			db.combos
				.where('characterId')
				.anyOf(characters.map((c) => c.id))
				.toArray(),
		[characters],
	);

	const comboCountByChar = useMemo(() => {
		const map: Record<string, number> = {};
		for (const combo of combos || []) {
			map[combo.characterId] = (map[combo.characterId] || 0) + 1;
		}
		return map;
	}, [combos]);

	const lastModifiedByChar = useMemo(() => {
		const map: Record<string, number> = {};
		for (const c of characters) {
			map[c.id] = c.updatedAt;
		}
		for (const combo of combos || []) {
			if (combo.updatedAt > (map[combo.characterId] || 0)) {
				map[combo.characterId] = combo.updatedAt;
			}
		}
		return map;
	}, [characters, combos]);

	const filteredAndSorted = useMemo(() => {
		let result = [...characters];
		if (filterSearch) {
			const q = filterSearch.toLowerCase();
			result = result.filter((c) => c.name.toLowerCase().includes(q));
		}
		result.sort((a, b) => {
			switch (sortBy) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'combos':
					return (comboCountByChar[b.id] || 0) - (comboCountByChar[a.id] || 0);
				case 'modified':
					return (
						(lastModifiedByChar[b.id] || 0) - (lastModifiedByChar[a.id] || 0)
					);
				default:
					return 0;
			}
		});
		return result;
	}, [characters, sortBy, filterSearch, comboCountByChar, lastModifiedByChar]);

	const hasActiveFilters = filterSearch !== '' || sortBy !== 'name-asc';

	const handleAdd = async () => {
		if (!name.trim()) {
			toast.error('Character name is required');
			return;
		}

		try {
			await indexedDbStorage.characters.add({
				gameId: game.id,
				name: name.trim(),
				notes: notes.trim(),
				portraitImage: portraitImage || undefined,
				portraitZoom: portraitZoom !== 100 ? portraitZoom : undefined,
				portraitPanX: portraitPanX !== 50 ? portraitPanX : undefined,
				portraitPanY: portraitPanY !== 50 ? portraitPanY : undefined,
			});
			toast.success('Character added');
			closeDialog();
		} catch {
			toast.error('Failed to add character');
		}
	};

	const openEditDialog = (character: Character) => {
		setEditTarget(character);
		setName(character.name);
		setNotes(character.notes || '');
		setPortraitImage(character.portraitImage || '');
		setPortraitZoom(character.portraitZoom || 100);
		setPortraitPanX(character.portraitPanX ?? 50);
		setPortraitPanY(character.portraitPanY ?? 50);
		setDialogOpen(true);
	};

	const handleEdit = async () => {
		if (!editTarget) return;
		if (!name.trim()) {
			toast.error('Character name is required');
			return;
		}
		try {
			await indexedDbStorage.characters.update(editTarget.id, {
				name: name.trim(),
				notes: notes.trim(),
				portraitImage: portraitImage || undefined,
				portraitZoom: portraitZoom !== 100 ? portraitZoom : undefined,
				portraitPanX: portraitPanX !== 50 ? portraitPanX : undefined,
				portraitPanY: portraitPanY !== 50 ? portraitPanY : undefined,
			});
			toast.success('Character updated');
			closeDialog();
		} catch {
			toast.error('Failed to update character');
		}
	};

	const closeDialog = () => {
		setDialogOpen(false);
		setEditTarget(null);
		setName('');
		setNotes('');
		setPortraitImage('');
		setPortraitZoom(100);
		setPortraitPanX(50);
		setPortraitPanY(50);
		setImageSearchOpen(false);
	};

	const handleDeleteCharacter = async (character: Character) => {
		try {
			await indexedDbStorage.characters.delete(character.id);
			toast.success(`"${character.name}" deleted`);
			setDeleteTarget(null);
		} catch {
			toast.error('Failed to delete character');
		}
	};

	const handleImageSelect = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			if (file.size > 2 * 1024 * 1024) {
				toast.error('Image must be under 2MB');
				return;
			}
			const reader = new FileReader();
			reader.onload = () => setPortraitImage(reader.result as string);
			reader.readAsDataURL(file);
		};
		input.click();
	};

	const characterDialog = (
		<Dialog
			open={dialogOpen}
			onOpenChange={(open) => {
				if (!open) closeDialog();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{editTarget ? 'Edit Character' : `Add Character to ${game.name}`}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label>Character Image (optional)</Label>
						<div className="flex items-start gap-3 mt-1">
							<div
								className="w-44 h-28 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border relative"
							>
								{portraitImage ? (
									<div
										className="absolute inset-0"
										style={{
											backgroundImage: `url(${portraitImage})`,
											backgroundSize: `${portraitZoom}%`,
											backgroundPosition: `${portraitPanX}% ${portraitPanY}%`,
											backgroundRepeat: 'no-repeat',
										}}
									/>
								) : (
									<ImageSquare className="w-8 h-8 text-muted-foreground" />
								)}
							</div>
							<div className="flex flex-col gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleImageSelect}
								>
									<ImageSquare className="w-4 h-4 mr-2 shrink-0" />
									Upload Image
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setImageSearchOpen(true)}
								>
									<MagnifyingGlass className="w-4 h-4 mr-2 shrink-0" />
									Search Images
								</Button>
								{portraitImage && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setPortraitImage('')}
										className="text-xs h-6 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600"
									>
										<X className="w-3.5 h-3.5 mr-1.5 shrink-0" />
										Remove
									</Button>
								)}
								{portraitImage && (
									<div className="flex items-center gap-2 mt-1">
										<span className="text-xs text-muted-foreground shrink-0">
											Zoom
										</span>
										<Slider
											min={100}
											max={200}
											step={5}
											value={[portraitZoom]}
											onValueChange={([v]) => setPortraitZoom(v)}
											className="flex-1"
										/>
										<span className="text-xs text-muted-foreground w-8 text-right">
											{portraitZoom}%
										</span>
									</div>
								)}
								{portraitImage && portraitZoom > 100 && (
									<>
										<div className="flex items-center gap-2">
											<span className="text-xs text-muted-foreground shrink-0">
												Pan X
											</span>
											<Slider
												min={0}
												max={100}
												step={1}
												value={[portraitPanX]}
												onValueChange={([v]) => setPortraitPanX(v)}
												className="flex-1"
											/>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-xs text-muted-foreground shrink-0">
												Pan Y
											</span>
											<Slider
												min={0}
												max={100}
												step={1}
												value={[portraitPanY]}
												onValueChange={([v]) => setPortraitPanY(v)}
												className="flex-1"
											/>
										</div>
									</>
								)}
							</div>
						</div>
					</div>

					<div>
						<Label htmlFor={charNameId}>Character Name</Label>
						<Input
							id={charNameId}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Ryu"
						/>
					</div>

					<div>
						<Label htmlFor={charNotesId}>Notes (optional)</Label>
						<Textarea
							id={charNotesId}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={closeDialog}>
							Cancel
						</Button>
						<Button onClick={editTarget ? handleEdit : handleAdd}>
							{editTarget ? 'Save Changes' : 'Add Character'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);

	if (characters.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
				<div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
					<User className="w-12 h-12 text-accent" />
				</div>

				<div className="text-center max-w-md">
					<h2 className="text-3xl font-bold mb-2">{game.name}</h2>
					<p className="text-muted-foreground mb-6">
						No characters added yet. Add your first character to start tracking
						combos.
					</p>
					<Button
						onClick={() => setDialogOpen(true)}
						size="lg"
						className="gap-2"
					>
						<Plus weight="bold" />
						Add Character
					</Button>
				</div>

				{characterDialog}
				<CharacterImageSearchDialog
					open={imageSearchOpen}
					onOpenChange={setImageSearchOpen}
					defaultQuery={`${game.name} ${name}`.trim()}
					onImageSelect={(base64) => {
						setPortraitImage(base64);
						setImageSearchOpen(false);
					}}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-3xl font-bold mb-2">{game.name}</h2>
					<p className="text-muted-foreground">
						Select a character to manage combos
					</p>
				</div>
				<div className="flex items-center gap-3">
					{viewMode === 'grid' && (
						<Slider
							min={120}
							max={300}
							step={10}
							value={[cardSize]}
							onValueChange={([v]) => {
								setCardSize(v);
								indexedDbStorage.settings
									.update({ characterCardSize: v })
									.then(() => useAppStore.getState().notifySettingsChanged());
							}}
							className="w-28"
							title="Card size"
						/>
					)}
					<div className="flex items-center border border-border rounded-md">
						<Button
							variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
							size="icon"
							className="h-9 w-9 rounded-r-none"
							onClick={() => setViewMode('grid')}
							title="Grid view"
						>
							<SquaresFour className="w-5 h-5" />
						</Button>
						<Button
							variant={viewMode === 'list' ? 'secondary' : 'ghost'}
							size="icon"
							className="h-9 w-9 rounded-l-none"
							onClick={() => setViewMode('list')}
							title="List view"
						>
							<List className="w-5 h-5" />
						</Button>
					</div>
					<Button
						variant={showFilters ? 'secondary' : 'ghost'}
						size="icon"
						onClick={() => setShowFilters(!showFilters)}
						title="Sort & Filter"
						className="relative"
					>
						<Funnel className="w-5 h-5" />
						{hasActiveFilters && (
							<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
						)}
					</Button>
					<Button onClick={() => setDialogOpen(true)} className="gap-2">
						<Plus weight="bold" />
						Add Character
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
					<Input
						placeholder="Search characters..."
						value={filterSearch}
						onChange={(e) => setFilterSearch(e.target.value)}
						className="w-48"
					/>
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as CharacterSort)}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name-asc">Name A–Z</SelectItem>
							<SelectItem value="name-desc">Name Z–A</SelectItem>
							<SelectItem value="combos">Most Combos</SelectItem>
							<SelectItem value="modified">Last Modified</SelectItem>
						</SelectContent>
					</Select>
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setFilterSearch('');
								setSortBy('name-asc');
							}}
							className="gap-1"
						>
							<X className="w-4 h-4" />
							Clear
						</Button>
					)}
					{filterSearch && (
						<span className="text-sm text-muted-foreground ml-auto">
							{filteredAndSorted.length} of {characters.length} characters
						</span>
					)}
				</div>
			)}

			<div
				className={viewMode === 'list' ? 'flex flex-col gap-3' : 'grid gap-4'}
				style={
					viewMode === 'grid'
						? {
							gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
						}
						: undefined
				}
			>
				{filteredAndSorted.map((character) =>
					viewMode === 'grid' ? (
						<Card
							key={character.id}
							className="group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden relative !py-0 !gap-0"
							style={{ height: `${Math.round(cardSize * 0.65)}px` }}
							onClick={() => setSelectedCharacter(character.id)}
						>
							<div
								className="absolute top-0 bottom-0 right-0"
								style={{
									left: '30%',
									backgroundImage: `url(${character.portraitImage || defaultCharacterImage})`,
									backgroundSize: `${character.portraitZoom || 100}%`,
									backgroundPosition: `${character.portraitPanX ?? 50}% ${character.portraitPanY ?? 50}%`,
									backgroundRepeat: 'no-repeat',
									maskImage:
										'linear-gradient(to left, black 0%, transparent 100%)',
									WebkitMaskImage:
										'linear-gradient(to left, black 0%, transparent 100%)',
								}}
							/>
							<CardContent className="p-0 relative z-10 flex flex-col justify-between flex-1">
								<div
									className="py-2 pl-4 pr-8"
									style={{
										background:
											'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
									}}
								>
									<h3
										className="font-bold text-white leading-tight"
										style={{
											fontSize: 'clamp(0.875rem, 1.25rem, 1.25rem)',
											display: '-webkit-box',
											WebkitLineClamp: 2,
											WebkitBoxOrient: 'vertical',
											overflow: 'hidden',
										}}
									>
										{character.name}
									</h3>
								</div>
								<div className="flex items-end justify-between mt-auto pb-1.5">
									<div className="text-left pl-4 pr-2 space-y-0.5">
										<p
											className="text-sm text-muted-foreground flex items-center gap-1.5"
											style={{ textShadow: '0 0 4px rgba(0,0,0,0.7)' }}
										>
											<GameController className="w-3.5 h-3.5" />{' '}
											{comboCountByChar[character.id] || 0} combos
										</p>
										<p
											className="text-sm text-muted-foreground flex items-center gap-1.5"
											style={{ textShadow: '0 0 4px rgba(0,0,0,0.7)' }}
										>
											<Timer className="w-3.5 h-3.5" />{' '}
											{new Date(
												lastModifiedByChar[character.id] || character.updatedAt,
											).toLocaleDateString(undefined, {
												month: 'short',
												day: 'numeric',
												year: 'numeric',
											})}
										</p>
									</div>
									<div className="flex gap-1 pr-2 pb-0.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
											onClick={(e) => {
												e.stopPropagation();
												openEditDialog(character);
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
												setDeleteTarget(character);
											}}
										>
											<Trash className="w-4 h-4" weight="bold" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					) : (
						<Card
							key={character.id}
							className="group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden h-[72px] !py-0 !gap-0"
							onClick={() => setSelectedCharacter(character.id)}
						>
							<CardContent className="p-0 flex items-center h-full">
								<div className="flex items-center gap-6 flex-1 pl-4 pr-2">
									<h3 className="font-bold text-white text-base min-w-[180px] truncate">
										{character.name}
									</h3>
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
										<GameController className="w-3.5 h-3.5" />{' '}
										{comboCountByChar[character.id] || 0} combos
									</p>
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
										<Timer className="w-3.5 h-3.5" />{' '}
										{new Date(
											lastModifiedByChar[character.id] || character.updatedAt,
										).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})}
									</p>
								</div>
								<div className="flex gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
										onClick={(e) => {
											e.stopPropagation();
											openEditDialog(character);
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
											setDeleteTarget(character);
										}}
									>
										<Trash className="w-4 h-4" weight="bold" />
									</Button>
								</div>
							</CardContent>
						</Card>
					),
				)}
			</div>

			{characterDialog}
			<CharacterImageSearchDialog
				open={imageSearchOpen}
				onOpenChange={setImageSearchOpen}
				defaultQuery={`${game.name} ${name}`.trim()}
				onImageSelect={(base64) => {
					setPortraitImage(base64);
					setImageSearchOpen(false);
				}}
			/>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{(() => {
								if (!deleteTarget) return '';
								const comboCount = comboCountByChar[deleteTarget.id] || 0;
								if (comboCount === 0)
									return 'This character has no combos. This action cannot be undone.';
								return `This will also delete ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
							})()}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								deleteTarget && handleDeleteCharacter(deleteTarget)
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
