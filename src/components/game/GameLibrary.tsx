import type { Game } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	Plus,
	GameController,
	Funnel,
	X,
	ImageSquare,
	Trash,
	PencilSimple,
	Timer,
	User,
	SquaresFour,
	List,
	MagnifyingGlass,
} from '@phosphor-icons/react';
import { CoverSearchDialog } from './CoverSearchDialog';
import defaultGameImage from '@/assets/images/defaultGame.jpg';
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
import { colorToHex } from '@/lib/utils';

const DEFAULT_BUTTON_PALETTE = [
	'#e53e3e',
	'#dd6b20',
	'#d69e2e',
	'#38a169',
	'#319795',
	'#3182ce',
	'#5a67d8',
	'#805ad5',
	'#d53f8c',
	'#718096',
];

type GameSort = 'name-asc' | 'name-desc' | 'characters' | 'combos' | 'modified';

interface GameLibraryProps {
	games: Game[];
}

export function GameLibrary({ games }: GameLibraryProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Game | null>(null);
	const [name, setName] = useState('');
	const [buttonLayout, setButtonLayout] = useState('L, M, H, S');
	const [notes, setNotes] = useState('');
	const [logoImage, setLogoImage] = useState('');
	const [coverZoom, setCoverZoom] = useState(100);
	const [coverPanX, setCoverPanX] = useState(50);
	const [coverPanY, setCoverPanY] = useState(50);
	const [dialogButtonColors, setDialogButtonColors] = useState<
		Record<string, string>
	>({});
	const [dialogHexEdits, setDialogHexEdits] = useState<Record<string, string>>(
		{},
	);
	const { setSelectedGame } = useAppStore();

	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState<GameSort>('name-asc');
	const [filterSearch, setFilterSearch] = useState('');
	const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const settings = useSettings();
	const [cardSize, setCardSize] = useState(settings.gameCardSize);
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		setCardSize(settings.gameCardSize);
	}, [settings.gameCardSize]);
	/* eslint-enable react-hooks/set-state-in-effect */
	const [coverSearchOpen, setCoverSearchOpen] = useState(false);

	const parsedButtons = useMemo(
		() =>
			buttonLayout
				.split(',')
				.map((b) => b.trim())
				.filter(Boolean),
		[buttonLayout],
	);

	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		setDialogButtonColors((prev) => {
			const updated: Record<string, string> = {};
			parsedButtons.forEach((btn, i) => {
				updated[btn] =
					prev[btn] ||
					DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length];
			});
			return updated;
		});
	}, [parsedButtons]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const formId = useId();
	const nameInputId = `${formId}-name`;
	const buttonsInputId = `${formId}-buttons`;
	const notesInputId = `${formId}-notes`;

	// Get character and combo counts per game
	const characters = useLiveQuery(() => db.characters.toArray(), []);
	const combos = useLiveQuery(() => db.combos.toArray(), []);

	const charCountByGame = useMemo(() => {
		const map: Record<string, number> = {};
		for (const c of characters || []) {
			map[c.gameId] = (map[c.gameId] || 0) + 1;
		}
		return map;
	}, [characters]);

	const comboCountByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId) map[gameId] = (map[gameId] || 0) + 1;
		}
		return map;
	}, [characters, combos]);

	const lastModifiedByGame = useMemo(() => {
		const charToGame: Record<string, string> = {};
		for (const c of characters || []) {
			charToGame[c.id] = c.gameId;
		}
		const map: Record<string, number> = {};
		for (const g of games) {
			map[g.id] = g.updatedAt;
		}
		for (const c of characters || []) {
			if (c.updatedAt > (map[c.gameId] || 0)) map[c.gameId] = c.updatedAt;
		}
		for (const combo of combos || []) {
			const gameId = charToGame[combo.characterId];
			if (gameId && combo.updatedAt > (map[gameId] || 0))
				map[gameId] = combo.updatedAt;
		}
		return map;
	}, [games, characters, combos]);

	const filteredAndSorted = useMemo(() => {
		let result = [...games];
		if (filterSearch) {
			const q = filterSearch.toLowerCase();
			result = result.filter((g) => g.name.toLowerCase().includes(q));
		}
		result.sort((a, b) => {
			switch (sortBy) {
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'characters':
					return (charCountByGame[b.id] || 0) - (charCountByGame[a.id] || 0);
				case 'combos':
					return (comboCountByGame[b.id] || 0) - (comboCountByGame[a.id] || 0);
				case 'modified':
					return (
						(lastModifiedByGame[b.id] || 0) - (lastModifiedByGame[a.id] || 0)
					);
				default:
					return 0;
			}
		});
		return result;
	}, [
		games,
		sortBy,
		filterSearch,
		charCountByGame,
		comboCountByGame,
		lastModifiedByGame,
	]);

	const hasActiveFilters = filterSearch !== '' || sortBy !== 'name-asc';
	const activeFilterCount =
		(filterSearch !== '' ? 1 : 0) + (sortBy !== 'name-asc' ? 1 : 0);

	const handleAdd = async () => {
		if (!name.trim()) {
			toast.error('Game name is required');
			return;
		}

		try {
			const buttons = buttonLayout
				.split(',')
				.map((b) => b.trim())
				.filter(Boolean);
			await indexedDbStorage.games.add({
				name: name.trim(),
				buttonLayout: buttons,
				buttonColors: { ...dialogButtonColors },
				notes: notes.trim(),
				logoImage: logoImage || undefined,
				coverZoom: coverZoom !== 100 ? coverZoom : undefined,
				coverPanX: coverPanX !== 50 ? coverPanX : undefined,
				coverPanY: coverPanY !== 50 ? coverPanY : undefined,
			});
			toast.success('Game added');
			closeDialog();
		} catch {
			toast.error('Failed to add game');
		}
	};

	const openEditDialog = (game: Game) => {
		setEditTarget(game);
		setName(game.name);
		setButtonLayout(game.buttonLayout.join(', '));
		setNotes(game.notes || '');
		setLogoImage(game.logoImage || '');
		setCoverZoom(game.coverZoom || 100);
		setCoverPanX(game.coverPanX ?? 50);
		setCoverPanY(game.coverPanY ?? 50);
		const existingColors = game.buttonColors || {};
		const initialColors: Record<string, string> = {};
		game.buttonLayout.forEach((btn, i) => {
			initialColors[btn] = colorToHex(
				existingColors[btn] ||
					DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length],
			);
		});
		setDialogButtonColors(initialColors);
		setDialogHexEdits({});
		setDialogOpen(true);
	};

	const handleEdit = async () => {
		if (!editTarget) return;
		if (!name.trim()) {
			toast.error('Game name is required');
			return;
		}
		try {
			const buttons = buttonLayout
				.split(',')
				.map((b) => b.trim())
				.filter(Boolean);
			await indexedDbStorage.games.update(editTarget.id, {
				name: name.trim(),
				buttonLayout: buttons,
				buttonColors: { ...dialogButtonColors },
				notes: notes.trim(),
				logoImage: logoImage || undefined,
				coverZoom: coverZoom !== 100 ? coverZoom : undefined,
				coverPanX: coverPanX !== 50 ? coverPanX : undefined,
				coverPanY: coverPanY !== 50 ? coverPanY : undefined,
			});
			toast.success('Game updated');
			closeDialog();
		} catch {
			toast.error('Failed to update game');
		}
	};

	const closeDialog = () => {
		setDialogOpen(false);
		setEditTarget(null);
		setName('');
		setButtonLayout('L, M, H, S');
		setNotes('');
		setLogoImage('');
		setCoverZoom(100);
		setCoverPanX(50);
		setCoverPanY(50);
		setDialogButtonColors({});
		setDialogHexEdits({});
		setCoverSearchOpen(false);
	};

	const handleDeleteGame = async (game: Game) => {
		try {
			await indexedDbStorage.games.delete(game.id);
			toast.success(`"${game.name}" deleted`);
			setDeleteTarget(null);
		} catch {
			toast.error('Failed to delete game');
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
			reader.onload = () => setLogoImage(reader.result as string);
			reader.readAsDataURL(file);
		};
		input.click();
	};

	const gameDialog = (
		<Dialog
			open={dialogOpen}
			onOpenChange={(open) => {
				if (!open) closeDialog();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editTarget ? 'Edit Game' : 'Add New Game'}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label>Cover Image (optional)</Label>
						<div className="flex items-start gap-3 mt-1">
							<div className="w-36 aspect-[3/4] shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
								{logoImage ? (
									<img
										src={logoImage}
										alt="Preview"
										className="w-full h-full object-cover"
										style={{
											transform: `scale(${coverZoom / 100})`,
											transformOrigin: `${coverPanX}% ${coverPanY}%`,
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
									className="h-8 text-sm px-4"
									onClick={handleImageSelect}
								>
									<ImageSquare className="w-4 h-4 mr-2 shrink-0" />
									Upload Image
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 text-sm px-4"
									onClick={() => setCoverSearchOpen(true)}
								>
									<MagnifyingGlass className="w-4 h-4 mr-2 shrink-0" />
									Search Covers
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={!logoImage}
									className="h-8 text-sm px-4 text-red-200 bg-red-900/70 hover:text-white hover:!bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
									onClick={() => setLogoImage('')}
								>
									<X className="w-3.5 h-3.5 mr-1.5 shrink-0" />
									Remove
								</Button>
								<div
									className={`flex items-center gap-2 mt-1 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
								>
									<span className="text-xs text-muted-foreground shrink-0">
										Zoom
									</span>
									<Slider
										min={100}
										max={200}
										step={5}
										value={[coverZoom]}
										onValueChange={([v]) => setCoverZoom(v)}
										className="flex-1"
										disabled={!logoImage}
									/>
									<span className="text-xs text-muted-foreground w-8 text-right">
										{coverZoom}%
									</span>
								</div>
								<div
									className={`flex items-center gap-2 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
								>
									<span className="text-xs text-muted-foreground shrink-0">
										Pan X
									</span>
									<Slider
										min={0}
										max={100}
										step={1}
										value={[coverPanX]}
										onValueChange={([v]) => setCoverPanX(v)}
										className="flex-1"
										disabled={!logoImage}
									/>
								</div>
								<div
									className={`flex items-center gap-2 ${!logoImage ? 'opacity-40 pointer-events-none' : ''}`}
								>
									<span className="text-xs text-muted-foreground shrink-0">
										Pan Y
									</span>
									<Slider
										min={0}
										max={100}
										step={1}
										value={[coverPanY]}
										onValueChange={([v]) => setCoverPanY(v)}
										className="flex-1"
										disabled={!logoImage}
									/>
								</div>
							</div>
						</div>
					</div>

					<div>
						<Label htmlFor={nameInputId}>Game Name</Label>
						<Input
							id={nameInputId}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Street Fighter 6"
						/>
					</div>

					<div>
						<Label htmlFor={buttonsInputId}>
							Button Layout (comma-separated)
						</Label>
						<Input
							id={buttonsInputId}
							value={buttonLayout}
							onChange={(e) => setButtonLayout(e.target.value)}
							placeholder="L, M, H, S"
						/>
					</div>

					{parsedButtons.length > 0 && (
						<div>
							<Label className="text-sm font-medium mb-2 block">
								Button Colors
							</Label>
							<div className="grid grid-cols-2 gap-x-4 gap-y-2">
								{parsedButtons.map((btn, i) => {
									const hexColor = colorToHex(
										dialogButtonColors[btn] ||
											DEFAULT_BUTTON_PALETTE[i % DEFAULT_BUTTON_PALETTE.length],
									);
									const editHex = dialogHexEdits[btn] ?? hexColor;
									return (
										<div key={btn} className="flex items-center gap-2">
											<span className="text-sm w-8 shrink-0 truncate">
												{btn}
											</span>
											<label className="relative w-10 h-7 rounded border border-border cursor-pointer overflow-hidden shrink-0">
												<div
													className="absolute inset-0"
													style={{ backgroundColor: hexColor }}
												/>
												<input
													type="color"
													value={hexColor}
													onChange={(e) => {
														setDialogButtonColors((prev) => ({
															...prev,
															[btn]: e.target.value,
														}));
														setDialogHexEdits((prev) => ({
															...prev,
															[btn]: e.target.value,
														}));
													}}
													className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
											</label>
											<input
												type="text"
												value={editHex}
												onChange={(e) =>
													setDialogHexEdits((prev) => ({
														...prev,
														[btn]: e.target.value,
													}))
												}
												onKeyDown={(e) => {
													if (e.key === 'Enter') e.currentTarget.blur();
												}}
												onBlur={(e) => {
													let val = e.target.value.trim();
													if (!val.startsWith('#')) val = `#${val}`;
													if (/^#[0-9a-fA-F]{6}$/.test(val)) {
														setDialogButtonColors((prev) => ({
															...prev,
															[btn]: val,
														}));
														setDialogHexEdits((prev) => ({
															...prev,
															[btn]: val,
														}));
													} else {
														setDialogHexEdits((prev) => ({
															...prev,
															[btn]: hexColor,
														}));
													}
												}}
												className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
											/>
										</div>
									);
								})}
							</div>
						</div>
					)}

					<div>
						<Label htmlFor={notesInputId}>Notes (optional)</Label>
						<Textarea
							id={notesInputId}
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
							{editTarget ? 'Save Changes' : 'Add Game'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);

	if (games.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
				<div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
					<GameController className="w-12 h-12 text-primary" />
				</div>

				<div className="text-center max-w-md">
					<h2 className="text-3xl font-bold mb-2">No Games Yet</h2>
					<p className="text-muted-foreground mb-6">
						Start tracking combos by adding your first fighting game
					</p>
					<Button
						onClick={() => setDialogOpen(true)}
						size="lg"
						className="gap-2"
					>
						<Plus weight="bold" />
						Add Your First Game
					</Button>
				</div>

				{gameDialog}
				<CoverSearchDialog
					open={coverSearchOpen}
					onOpenChange={setCoverSearchOpen}
					defaultQuery={name}
					onCoverSelect={(base64) => {
						setLogoImage(base64);
						setCoverSearchOpen(false);
					}}
				/>
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-2 mb-8 min-w-0 w-full">
				<div className="min-w-0">
					<h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3 truncate">
						Game Library
						<span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold px-2.5 py-0.5 tabular-nums">
							{games.length}
						</span>
					</h2>
					<p className="text-muted-foreground truncate">
						Select a game to manage characters and combos
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
					{viewMode === 'grid' && (
						<div className="flex items-center gap-1.5 bg-muted rounded-md px-2.5 h-9">
							<span className="text-xs text-muted-foreground select-none">
								Size
							</span>
							<Slider
								min={120}
								max={300}
								step={10}
								value={[cardSize]}
								onValueChange={([v]) => {
									setCardSize(v);
									indexedDbStorage.settings
										.update({ gameCardSize: v })
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
					<Button onClick={() => setDialogOpen(true)} className="gap-2">
						<Plus weight="bold" />
						Add Game
					</Button>
				</div>
			</div>

			{showFilters && (
				<div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
					<Input
						placeholder="Search games..."
						value={filterSearch}
						onChange={(e) => setFilterSearch(e.target.value)}
						className="w-48"
					/>
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as GameSort)}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name-asc">Name A–Z</SelectItem>
							<SelectItem value="name-desc">Name Z–A</SelectItem>
							<SelectItem value="characters">Most Characters</SelectItem>
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
							{filteredAndSorted.length} of {games.length} games
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
				{filteredAndSorted.map((game) =>
					viewMode === 'grid' ? (
						<Card
							key={game.id}
							className="group cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary overflow-hidden relative aspect-[3/4] !py-0 !gap-0 hover:scale-[1.03]"
							onClick={() => setSelectedGame(game.id)}
						>
							<div
								className="absolute inset-0"
								style={{
									backgroundImage: `url(${game.logoImage || defaultGameImage})`,
									backgroundSize: game.coverZoom
										? `${game.coverZoom}%`
										: 'cover',
									backgroundPosition: game.coverZoom
										? `${game.coverPanX ?? 50}% ${game.coverPanY ?? 50}%`
										: 'center',
									backgroundRepeat: 'no-repeat',
								}}
							/>
							<CardContent className="p-0 relative z-10 flex flex-col justify-end h-full">
								<div
									className="p-3 pt-16"
									style={{
										background:
											'linear-gradient(to top, black 0%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.35) 75%, transparent 100%)',
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
										{game.name}
									</h3>
									<div className="flex items-center gap-3 text-sm text-gray-300">
										<span className="flex items-center gap-1">
											<User className="w-3.5 h-3.5" />{' '}
											{charCountByGame[game.id] || 0} characters
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
											openEditDialog(game);
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
											if (settings.confirmBeforeDelete) {
												setDeleteTarget(game);
											} else {
												handleDeleteGame(game);
											}
										}}
									>
										<Trash className="w-4 h-4" weight="bold" />
									</Button>
								</div>
							</CardContent>
						</Card>
					) : (
						<Card
							key={game.id}
							className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary overflow-hidden h-[72px] !py-0 !gap-0"
							onClick={() => setSelectedGame(game.id)}
						>
							<CardContent className="p-0 flex items-center h-full">
								<div className="flex items-center gap-6 flex-1 pl-4 pr-2">
									<h3 className="font-bold text-white text-base min-w-[180px] truncate">
										{game.name}
									</h3>
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
										<User className="w-3.5 h-3.5" />{' '}
										{charCountByGame[game.id] || 0} characters
									</p>
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
										<GameController className="w-3.5 h-3.5" />{' '}
										{comboCountByGame[game.id] || 0} combos
									</p>
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
										<Timer className="w-3.5 h-3.5" />{' '}
										{new Date(
											lastModifiedByGame[game.id] || game.updatedAt,
										).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})}
									</p>
								</div>
								<div className="flex gap-1 pr-3">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-blue-200 bg-blue-900/70 hover:text-white hover:!bg-blue-600"
										onClick={(e) => {
											e.stopPropagation();
											openEditDialog(game);
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
											if (settings.confirmBeforeDelete) {
												setDeleteTarget(game);
											} else {
												handleDeleteGame(game);
											}
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

			{gameDialog}

			<CoverSearchDialog
				open={coverSearchOpen}
				onOpenChange={setCoverSearchOpen}
				defaultQuery={name}
				onCoverSelect={(base64) => {
					setLogoImage(base64);
					setCoverSearchOpen(false);
				}}
			/>

			{settings.confirmBeforeDelete && (
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
									const charCount = charCountByGame[deleteTarget.id] || 0;
									const comboCount = comboCountByGame[deleteTarget.id] || 0;
									if (charCount === 0)
										return 'This game has no characters or combos. This action cannot be undone.';
									return `This will also delete ${charCount} character${charCount !== 1 ? 's' : ''} and ${comboCount} combo${comboCount !== 1 ? 's' : ''}. This action cannot be undone.`;
								})()}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={() => deleteTarget && handleDeleteGame(deleteTarget)}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}
