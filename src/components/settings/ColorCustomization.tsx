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
	const [loading, setLoading] = useState(true);

	const loadData = useCallback(async () => {
		setLoading(true);
		const settings = await indexedDbStorage.settings.get();
		const allGames = await indexedDbStorage.games.getAll();
		setColors(settings.notationColors);
		setTempColors(settings.notationColors);
		setGames(allGames);
		if (allGames.length > 0) {
			setSelectedGameId(allGames[0].id);
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
					const colorIndex = idx % 3;
					const defaultColor =
						colorIndex === 0
							? 'oklch(0.70 0.18 210)'
							: colorIndex === 1
								? 'oklch(0.75 0.19 145)'
								: 'oklch(0.68 0.22 25)';
					acc[btn] = defaultColor;
					return acc;
				},
				{} as Record<string, string>,
			);

			setTempButtonColors(defaultButtonColors);
			await indexedDbStorage.games.update(selectedGameId, {
				buttonColors: defaultButtonColors,
			});
			await loadData();
		}

		toast.success('Colors reset to defaults');
		useAppStore.getState().notifySettingsChanged();
	};

	const oklchToHex = (oklchString: string): string => {
		const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
		if (!match) return '#3b82f6';

		const l = parseFloat(match[1]);
		const c = parseFloat(match[2]);
		const h = parseFloat(match[3]);

		const hRad = (h * Math.PI) / 180;
		const a = c * Math.cos(hRad);
		const b = c * Math.sin(hRad);

		let x = 0.96422 * l + 0.39529 * a + 0.19852 * b;
		let y = 1.0 * l;
		let z = 1.0885 * l - 0.10527 * b;

		x = x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x;
		y = y > 0.0031308 ? 1.055 * y ** (1 / 2.4) - 0.055 : 12.92 * y;
		z = z > 0.0031308 ? 1.055 * z ** (1 / 2.4) - 0.055 : 12.92 * z;

		const r = Math.round(
			Math.max(0, Math.min(255, x * 3.2406 + y * -1.5372 + z * -0.4986)),
		);
		const g = Math.round(
			Math.max(0, Math.min(255, x * -0.9689 + y * 1.8758 + z * 0.0415)),
		);
		const bVal = Math.round(
			Math.max(0, Math.min(255, x * 0.0557 + y * -0.204 + z * 1.057)),
		);

		return `#${[r, g, bVal].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
	};

	const hexToOklch = (hex: string): string => {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;

		let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
		let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
		let z = r * 0.0193 + g * 0.1192 + b * 0.9505;

		x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
		y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
		z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;

		const l = Math.max(0, 116 * y - 16) / 100;
		const a = (500 * (x - y)) / 100;
		const bVal = (200 * (y - z)) / 100;

		const c = Math.sqrt(a * a + bVal * bVal);
		let h = (Math.atan2(bVal, a) * 180) / Math.PI;
		if (h < 0) h += 360;

		return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`;
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
										const newColor = hexToOklch(e.target.value);
										handleColorChange('separator', newColor);
									}}
									className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
								/>
							</label>
							<span className="text-xs text-muted-foreground font-mono">
								{oklchToHex(tempColors.separator)}
							</span>
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
							{selectedGame.buttonLayout.map((button) => (
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
												style={{
													backgroundColor:
														tempButtonColors[button] || 'oklch(0.70 0.18 210)',
												}}
											/>
											<input
												type="color"
												value={oklchToHex(
													tempButtonColors[button] || 'oklch(0.70 0.18 210)',
												)}
												onChange={(e) => {
													const newColor = hexToOklch(e.target.value);
													handleButtonColorChange(button, newColor);
												}}
												className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
											/>
										</label>
										<span className="text-xs text-muted-foreground font-mono">
											{oklchToHex(
												tempButtonColors[button] || 'oklch(0.70 0.18 210)',
											)}
										</span>
									</div>
								</div>
							))}
						</div>
					)}

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
				</CardContent>
			</Card>
		</div>
	);
}
