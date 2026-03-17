import { useState, useEffect, useCallback } from 'react';
import type { NotationColors, Game } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowClockwise } from '@phosphor-icons/react';
import { useAppStore } from '@/lib/store';
import { oklchToHex, hexToOklch, colorToHex } from '@/lib/utils';

const DEFAULT_BUTTON_PALETTE = [
	'#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795',
	'#3182ce', '#5a67d8', '#805ad5', '#d53f8c', '#718096',
];
const DEFAULT_COLORS: NotationColors = {
	direction: 'oklch(0.85 0.05 265)',
	separator: 'oklch(0.55 0.02 265)',
};

export function ColorCustomization() {
	const [_colors, setColors] = useState<NotationColors>(DEFAULT_COLORS);
	const [tempColors, setTempColors] = useState<NotationColors>(DEFAULT_COLORS);
	const [selectedGameId, setSelectedGameId] = useState<string>('');
	const [games, setGames] = useState<Game[]>([]);
	const [selectedGame, setSelectedGame] = useState<Game | undefined>();
	const [tempButtonColors, setTempButtonColors] = useState<
		Record<string, string>
	>({});
	const [hexEdits, setHexEdits] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(true);

	const loadData = useCallback(async () => {
		setLoading(true);
		const settings = await indexedDbStorage.settings.get();
		const allGames = await indexedDbStorage.games.getAll();
		const sorted = allGames.slice().sort((a, b) => a.name.localeCompare(b.name));
		setColors(settings.notationColors);
		setTempColors(settings.notationColors);
		setGames(sorted);
		if (sorted.length > 0) {
			setSelectedGameId(sorted[0].id);
		}
		setLoading(false);
	}, []);

	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		loadData();
	}, [loadData]);
	/* eslint-enable react-hooks/set-state-in-effect */

	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		const game = games.find((g) => g.id === selectedGameId);
		setSelectedGame(game);
		setTempButtonColors(game?.buttonColors || {});
		setHexEdits({});
	}, [selectedGameId, games]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const handleColorChange = (key: keyof NotationColors, value: string) => {
		setTempColors((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const handleButtonColorChange = (button: string, value: string) => {
		setTempButtonColors((prev) => ({
			...prev,
			[button]: value,
		}));
	};

	const handleApply = async () => {
		await indexedDbStorage.settings.update({ notationColors: tempColors });
		setColors(tempColors);

		if (selectedGameId && tempButtonColors) {
			await indexedDbStorage.games.update(selectedGameId, {
				buttonColors: tempButtonColors,
			});
			await loadData();
		}

		toast.success('Colors updated successfully');
		useAppStore.getState().notifySettingsChanged();
	};

	const handleReset = async () => {
		setTempColors(DEFAULT_COLORS);
		await indexedDbStorage.settings.update({ notationColors: DEFAULT_COLORS });
		setColors(DEFAULT_COLORS);

		if (selectedGameId && selectedGame) {
			const defaultButtonColors = selectedGame.buttonLayout.reduce(
				(acc, btn, idx) => {
					acc[btn] = DEFAULT_BUTTON_PALETTE[idx % DEFAULT_BUTTON_PALETTE.length];
					return acc;
				},
				{} as Record<string, string>,
			);

			setTempButtonColors(defaultButtonColors);
			await indexedDbStorage.games.update(selectedGameId, {
				buttonColors: defaultButtonColors,
			});
			setHexEdits({});
			await loadData();
		}

		toast.success('Colors reset to defaults');
		useAppStore.getState().notifySettingsChanged();
	};

	if (loading) {
		return <div className="text-sm text-muted-foreground">Loading...</div>;
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Separator Color</CardTitle>
					<CardDescription>
						Customize the color of combo separators (e.g. &gt;, ~, etc.)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4">
						<div className="flex-1">
							<Label className="text-sm font-medium">Separators</Label>
						</div>
						<div className="flex items-center gap-3">
							<label className="relative w-20 h-10 rounded-md border border-border shadow-sm cursor-pointer overflow-hidden">
								<div
									className="absolute inset-0"
									style={{ backgroundColor: tempColors.separator }}
								/>
								<input
									type="color"
									value={oklchToHex(tempColors.separator)}
									onChange={(e) => {
										handleColorChange('separator', hexToOklch(e.target.value));
										setHexEdits((prev) => ({ ...prev, separator: e.target.value }));
									}}
									className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
								/>
							</label>
							{(() => {
								const currentHex = oklchToHex(tempColors.separator);
								return (
									<input
										type="text"
										value={hexEdits.separator ?? currentHex}
										onChange={(e) => setHexEdits((prev) => ({ ...prev, separator: e.target.value }))}
										onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
										onBlur={(e) => {
											let val = e.target.value.trim();
											if (!val.startsWith('#')) val = `#${val}`;
											if (/^#[0-9a-fA-F]{6}$/.test(val)) {
												handleColorChange('separator', hexToOklch(val));
												setHexEdits((prev) => ({ ...prev, separator: val }));
											} else {
												setHexEdits((prev) => ({ ...prev, separator: currentHex }));
											}
										}}
										className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
									/>
								);
							})()}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Game-Specific Button Colors</CardTitle>
					<CardDescription>
						Customize button colors for each game — motions and modifiers
						inherit from their paired button
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<Label className="text-sm font-medium mb-2 block">
							Select Game
						</Label>
						<Select value={selectedGameId} onValueChange={setSelectedGameId}>
							<SelectTrigger>
								<SelectValue placeholder="Choose a game" />
							</SelectTrigger>
							<SelectContent>
								{games.map((game) => (
									<SelectItem key={game.id} value={game.id}>
										{game.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{selectedGame && (
						<div className="grid gap-4 pt-2">
							{selectedGame.buttonLayout.map((button) => {
								const currentHex = colorToHex(tempButtonColors[button] || '#3b82f6');
								const editHex = hexEdits[button] ?? currentHex;
								return (
									<div key={button} className="flex items-center gap-4">
										<div className="flex-1">
											<Label className="text-sm font-medium">
												{button} Button
											</Label>
										</div>
										<div className="flex items-center gap-3">
											<label className="relative w-20 h-10 rounded-md border border-border shadow-sm cursor-pointer overflow-hidden">
												<div
													className="absolute inset-0"
													style={{ backgroundColor: currentHex }}
												/>
												<input
													type="color"
													value={currentHex}
													onChange={(e) => {
														handleButtonColorChange(button, e.target.value);
														setHexEdits((prev) => ({ ...prev, [button]: e.target.value }));
													}}
													className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
											</label>
											<input
												type="text"
												value={editHex}
												onChange={(e) => setHexEdits((prev) => ({ ...prev, [button]: e.target.value }))}
												onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
												onBlur={(e) => {
													let val = e.target.value.trim();
													if (!val.startsWith('#')) val = `#${val}`;
													if (/^#[0-9a-fA-F]{6}$/.test(val)) {
														handleButtonColorChange(button, val);
														setHexEdits((prev) => ({ ...prev, [button]: val }));
													} else {
														setHexEdits((prev) => ({ ...prev, [button]: currentHex }));
													}
												}}
												className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
											/>
										</div>
									</div>
								);
							})}

							<div className="flex gap-2 pt-4">
								<Button onClick={handleApply} className="flex-1">
									Apply Changes
								</Button>
								<Button
									onClick={handleReset}
									variant="outline"
									className="flex items-center gap-2"
								>
									<ArrowClockwise className="w-4 h-4" />
									Reset to Defaults
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
