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
	Note,
	CaretDown,
	Palette,
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
	DialogFooter,
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
import { colorToHex } from '@/lib/utils';

type CharacterSort = 'name-asc' | 'name-desc' | 'combos' | 'modified';

const clampCharSize = (v: number) => Math.min(300, Math.max(120, v));

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

	const DEFAULT_BTN_PALETTE = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795', '#3182ce', '#5a67d8', '#805ad5', '#d53f8c', '#718096'];

	const [colorDialogOpen, setColorDialogOpen] = useState(false);
	const [tempGameColors, setTempGameColors] = useState<Record<string, string>>({});
	const [colorHexEdits, setColorHexEdits] = useState<Record<string, string>>({});
	const [tempButtonLayout, setTempButtonLayout] = useState<string[]>([]);
	const [newButtonName, setNewButtonName] = useState('');

	const openColorDialog = () => {
		const layout = [...game.buttonLayout];
		const initial: Record<string, string> = {};
		layout.forEach((btn, i) => {
			initial[btn] = colorToHex(game.buttonColors?.[btn] || DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length]);
		});
		setTempButtonLayout(layout);
		setTempGameColors(initial);
		setColorHexEdits({});
		setNewButtonName('');
		setColorDialogOpen(true);
	};

	const handleSaveGameColors = async () => {
		try {
			const colorsToSave: Record<string, string> = {};
			tempButtonLayout.forEach((btn) => {
				colorsToSave[btn] = tempGameColors[btn] || DEFAULT_BTN_PALETTE[tempButtonLayout.indexOf(btn) % DEFAULT_BTN_PALETTE.length];
			});
			await indexedDbStorage.games.update(game.id, { buttonLayout: tempButtonLayout, buttonColors: colorsToSave });
			useAppStore.getState().notifySettingsChanged();
			toast.success('Button colors updated');
			setColorDialogOpen(false);
		} catch {
			toast.error('Failed to update colors');
		}
	};

	const addButton = () => {
		const name = newButtonName.trim();
		if (name && !tempButtonLayout.includes(name)) {
			const i = tempButtonLayout.length;
			setTempButtonLayout((prev) => [...prev, name]);
			setTempGameColors((prev) => ({ ...prev, [name]: DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length] }));
			setNewButtonName('');
		}
	};

	const [showNotes, setShowNotes] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<CharacterSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');
	const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const settings = useSettings();
	const [cardSize, setCardSize] = useState(() => clampCharSize(settings.characterCardSize));
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		setCardSize(clampCharSize(settings.characterCardSize));
	}, [settings.characterCardSize]);

	// Initialise notes panel from default setting + per-entity localStorage override
	const defaultNotesOpen = settings.notesDefaultOpen ?? false;
	useEffect(() => {
		const overrides: string[] = JSON.parse(
			localStorage.getItem('notes_overrides') ?? '[]',
		);
		const isOverridden = overrides.includes(game.id);
		setShowNotes(isOverridden ? !defaultNotesOpen : defaultNotesOpen);
	}, [game.id, defaultNotesOpen]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const handleToggleNotes = () => {
		const next = !showNotes;
		setShowNotes(next);
		const overrides: string[] = JSON.parse(
			localStorage.getItem('notes_overrides') ?? '[]',
		);
		const updated =
			next !== defaultNotesOpen
				? [...new Set([...overrides, game.id])]
				: overrides.filter((id) => id !== game.id);
		localStorage.setItem('notes_overrides', JSON.stringify(updated));
	};
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
	const activeFilterCount = (filterSearch !== '' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

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
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={!portraitImage}
									onClick={() => setPortraitImage('')}
									className="text-xs h-6 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
								>
									<X className="w-3.5 h-3.5 mr-1.5 shrink-0" />
									Remove
								</Button>
								<div className={`flex items-center gap-2 mt-1 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}>
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
										disabled={!portraitImage}
									/>
									<span className="text-xs text-muted-foreground w-8 text-right">
										{portraitZoom}%
									</span>
								</div>
								<div className={`flex items-center gap-2 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}>
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
										disabled={!portraitImage}
									/>
								</div>
								<div className={`flex items-center gap-2 ${!portraitImage ? 'opacity-40 pointer-events-none' : ''}`}>
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
										disabled={!portraitImage}
									/>
								</div>
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
				<div className="flex items-center gap-2">
					{viewMode === 'grid' && (
						<div className="flex items-center gap-1.5 bg-muted rounded-md px-2.5 h-9">
							<span className="text-xs text-muted-foreground select-none">Size</span>
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
								className="w-24"
								title="Card size"
							/>
						</div>
					)}
					<div className="flex items-center bg-muted rounded-md">
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
					<div className="bg-muted rounded-md">
						<Button
							variant={showFilters ? 'secondary' : 'ghost'}
							size="icon"
							onClick={() => setShowFilters(!showFilters)}
							title="Sort & Filter"
							className="relative"
						>
							<Funnel className="w-5 h-5" />
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center leading-none px-0.5">
									{activeFilterCount}
								</span>
							)}
						</Button>
					</div>
					<div className="bg-muted rounded-md">
						<Button
							variant="ghost"
							size="icon"
							onClick={openColorDialog}
							title="Edit button colors"
						>
							<Palette className="w-5 h-5" />
						</Button>
					</div>
					<Button onClick={() => setDialogOpen(true)} className="gap-2">
						<Plus weight="bold" />
						Add Character
					</Button>
				</div>
			</div>

			{game.notes?.trim() && (
				<div className="mb-6 border border-border rounded-lg overflow-hidden">
					<button
						type="button"
						onClick={handleToggleNotes}
						className="w-full flex items-center justify-between px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors"
					>
						<span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							<Note className="w-4 h-4" />
							Notes
						</span>
						<CaretDown className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${showNotes ? 'rotate-180' : ''}`} />
					</button>
					{showNotes && (
						<div className="px-4 py-3 bg-card border-t border-border">
							<p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{game.notes}</p>
						</div>
					)}
				</div>
			)}

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
							gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(cardSize * 4 / 3)}px, 1fr))`,
						}
						: undefined
				}
			>
				{filteredAndSorted.map((character) =>
					viewMode === 'grid' ? (
						<Card
							key={character.id}
							className="group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-accent overflow-hidden relative aspect-[4/3] !py-0 !gap-0 hover:scale-[1.03]"
							onClick={() => setSelectedCharacter(character.id)}
						>
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
											<GameController className="w-3.5 h-3.5" />{' '}
											{comboCountByChar[character.id] || 0} combos
										</span>
									</div>
								</div>
								<div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600 cursor-pointer"
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
										className="h-7 w-7 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 cursor-pointer"
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

			<Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Button Colors — {game.name}</DialogTitle>

					</DialogHeader>
					<div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
						{tempButtonLayout.map((btn, i) => {
							const hexColor = colorToHex(tempGameColors[btn] || DEFAULT_BTN_PALETTE[i % DEFAULT_BTN_PALETTE.length]);
							const editHex = colorHexEdits[btn] ?? hexColor;
							return (
								<div key={btn} className="flex items-center gap-2">
									<span className="text-sm w-8 shrink-0 truncate">{btn}</span>
									<label className="relative w-10 h-7 rounded border border-border cursor-pointer overflow-hidden shrink-0">
										<div className="absolute inset-0" style={{ backgroundColor: hexColor }} />
										<input
											type="color"
											value={hexColor}
											onChange={(e) => {
												setTempGameColors((prev) => ({ ...prev, [btn]: e.target.value }));
												setColorHexEdits((prev) => ({ ...prev, [btn]: e.target.value }));
											}}
											className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
										/>
									</label>
									<input
										type="text"
										value={editHex}
										onChange={(e) => setColorHexEdits((prev) => ({ ...prev, [btn]: e.target.value }))}
										onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
										onBlur={(e) => {
											let val = e.target.value.trim();
											if (!val.startsWith('#')) val = `#${val}`;
											if (/^#[0-9a-fA-F]{6}$/.test(val)) {
												setTempGameColors((prev) => ({ ...prev, [btn]: val }));
												setColorHexEdits((prev) => ({ ...prev, [btn]: val }));
											} else {
												setColorHexEdits((prev) => ({ ...prev, [btn]: hexColor }));
											}
										}}
										className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
									/>
									<button
										type="button"
										onClick={() => setTempButtonLayout((prev) => prev.filter((b) => b !== btn))}
										className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
										title={`Remove ${btn}`}
									>
										<X className="w-3.5 h-3.5" />
									</button>
								</div>
							);
						})}
					</div>
					<div className="flex gap-2 mt-3 pt-3 border-t border-border">
						<Input
							placeholder="Button name (e.g. LP)"
							value={newButtonName}
							onChange={(e) => setNewButtonName(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Enter') addButton(); }}
							className="h-8 text-sm"
						/>
						<Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addButton}>
							<Plus className="w-4 h-4 mr-1" weight="bold" />
							Add
						</Button>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setColorDialogOpen(false)}>Cancel</Button>
						<Button onClick={handleSaveGameColors}>Apply</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
