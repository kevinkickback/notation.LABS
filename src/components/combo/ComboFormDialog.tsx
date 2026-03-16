import type { Game, Character, Combo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { X, Play, VideoCamera } from '@phosphor-icons/react';
import { useState, useEffect, useMemo, useCallback, useId } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { parseComboNotation } from '@/lib/parser';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { toast } from 'sonner';

function getYouTubeVideoId(url: string): string | null {
	try {
		const u = new URL(url);
		if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
		if (u.hostname.includes('youtu.be'))
			return u.pathname.slice(1).split('/')[0];
	} catch {
		/* not a valid URL */
	}
	return null;
}

interface ComboFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	game: Game;
	character: Character;
	editingCombo: Combo | null;
	allTags: string[];
}

export function ComboFormDialog({
	open,
	onOpenChange,
	game,
	character,
	editingCombo,
	allTags,
}: ComboFormDialogProps) {
	const [name, setName] = useState('');
	const [notation, setNotation] = useState('');
	const [description, setDescription] = useState('');
	const [difficulty, setDifficulty] = useState('');
	const [damage, setDamage] = useState('');
	const [meterCost, setMeterCost] = useState('');
	const [tags, setTags] = useState('');
	const [tagInput, setTagInput] = useState('');
	const [demoUrl, setDemoUrl] = useState('');
	const [demoFileName, setDemoFileName] = useState('');
	const [demoVideoTitle, setDemoVideoTitle] = useState('');
	const [outdated, setOutdated] = useState(false);

	const comboNameId = useId();
	const comboNotationId = useId();
	const comboDamageId = useId();
	const comboMeterId = useId();
	const comboDescriptionId = useId();
	const tagSuggestionsId = useId();

	const resetForm = useCallback(() => {
		setName('');
		setNotation('');
		setDescription('');
		setDifficulty('');
		setDamage('');
		setMeterCost('');
		setTags('');
		setTagInput('');
		setDemoUrl('');
		setDemoFileName('');
		setDemoVideoTitle('');
		setOutdated(false);
	}, []);

	// Populate form when editing
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (editingCombo) {
			setName(editingCombo.name);
			setNotation(editingCombo.notation);
			setDescription(editingCombo.description || '');
			setDifficulty(
				editingCombo.difficulty ? editingCombo.difficulty.toString() : '',
			);
			setDamage(editingCombo.damage || '');
			setMeterCost(editingCombo.meterCost || '');
			setTags(editingCombo.tags.join(', '));
			setDemoUrl(editingCombo.demoUrl || '');
			setDemoFileName(editingCombo.demoFileName || '');
			setDemoVideoTitle(editingCombo.demoVideoTitle || '');
			setOutdated(editingCombo.outdated || false);
		} else {
			resetForm();
		}
	}, [editingCombo, resetForm]);
	/* eslint-enable react-hooks/set-state-in-effect */

	// Fetch YouTube video title when URL changes
	useEffect(() => {
		if (!demoUrl || demoUrl.startsWith('local:')) {
			setDemoVideoTitle(''); // eslint-disable-line react-hooks/set-state-in-effect
			return;
		}
		const videoId = getYouTubeVideoId(demoUrl);
		if (!videoId) {
			setDemoVideoTitle('');
			return;
		}
		let cancelled = false;
		fetch(`https://noembed.com/embed?url=${encodeURIComponent(demoUrl)}`)
			.then((r) => r.json())
			.then((data) => {
				if (!cancelled && data.title) setDemoVideoTitle(data.title);
			})
			.catch(() => {
				if (!cancelled) setDemoVideoTitle('');
			});
		return () => {
			cancelled = true;
		};
	}, [demoUrl]);

	const handleAdd = async () => {
		if (!name.trim() || !notation.trim()) {
			toast.error('Name and notation are required');
			return;
		}

		try {
			const parsed = parseComboNotation(notation, game.buttonLayout);
			await indexedDbStorage.combos.add({
				characterId: character.id,
				name: name.trim(),
				notation: notation.trim(),
				parsedNotation: parsed,
				description: description.trim(),
				difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
				damage: damage.trim(),
				meterCost: meterCost.trim(),
				tags: tags
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean),
				demoUrl: demoUrl.trim() || undefined,
				demoFileName: demoFileName || undefined,
				demoVideoTitle: demoVideoTitle || undefined,
				outdated: outdated || undefined,
			});
			toast.success('Combo added');
			onOpenChange(false);
			resetForm();
		} catch {
			toast.error('Failed to add combo');
		}
	};

	const handleUpdate = async () => {
		if (!editingCombo || !name.trim() || !notation.trim()) {
			toast.error('Name and notation are required');
			return;
		}

		try {
			const oldLocalId = editingCombo.demoUrl?.startsWith('local:')
				? editingCombo.demoUrl.replace('local:', '')
				: null;
			const newLocalId = demoUrl.startsWith('local:')
				? demoUrl.replace('local:', '')
				: null;
			if (oldLocalId && oldLocalId !== newLocalId) {
				await indexedDbStorage.demoVideos.delete(oldLocalId);
			}

			const parsed = parseComboNotation(notation, game.buttonLayout);
			await indexedDbStorage.combos.update(editingCombo.id, {
				name: name.trim(),
				notation: notation.trim(),
				parsedNotation: parsed,
				description: description.trim(),
				difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
				damage: damage.trim(),
				meterCost: meterCost.trim(),
				tags: tags
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean),
				demoUrl: demoUrl.trim() || undefined,
				demoFileName: demoFileName || undefined,
				outdated: outdated || undefined,
				demoVideoTitle: demoVideoTitle || undefined,
			});
			toast.success('Combo updated');
			onOpenChange(false);
			resetForm();
		} catch {
			toast.error('Failed to update combo');
		}
	};

	const handleVideoFileSelect = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'video/*';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			try {
				if (demoUrl.startsWith('local:')) {
					const oldId = demoUrl.replace('local:', '');
					const origLocalId = editingCombo?.demoUrl?.startsWith('local:')
						? editingCombo.demoUrl.replace('local:', '')
						: null;
					if (oldId !== origLocalId) {
						await indexedDbStorage.demoVideos.delete(oldId);
					}
				}

				const buffer = await file.arrayBuffer();
				const videoId = `video-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
				await indexedDbStorage.demoVideos.add({
					id: videoId,
					data: buffer,
					mimeType: file.type,
					fileName: file.name,
				});
				setDemoUrl(`local:${videoId}`);
				setDemoFileName(file.name);
			} catch {
				toast.error('Failed to save video file');
			}
		};
		input.click();
	};

	// Tag helpers
	const currentTags = tags
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	const tagSuggestions = useMemo(
		() => allTags.filter((t) => !currentTags.includes(t)),
		[allTags, currentTags],
	);

	const commitTag = (value: string) => {
		const val = value.trim();
		if (val && !currentTags.includes(val)) {
			const updated = [...currentTags, val];
			setTags(updated.join(', '));
		}
		setTagInput('');
	};

	const removeTag = (tag: string) => {
		const updated = currentTags.filter((t) => t !== tag);
		setTags(updated.join(', '));
	};

	const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Tab' && tagInput.trim()) {
			const match = tagSuggestions.find((t) =>
				t.toLowerCase().startsWith(tagInput.toLowerCase()),
			);
			if (match) {
				e.preventDefault();
				commitTag(match);
			}
		} else if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitTag(tagInput);
		} else if (
			e.key === 'Backspace' &&
			tagInput === '' &&
			currentTags.length > 0
		) {
			removeTag(currentTags[currentTags.length - 1]);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				onOpenChange(isOpen);
				if (!isOpen) resetForm();
			}}
		>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{editingCombo ? 'Edit' : 'Add'} Combo for {character.name}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor={comboNameId}>Combo Name *</Label>
						<Input
							id={comboNameId}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="BnB Corner Combo"
						/>
					</div>

					<div>
						<Label htmlFor={comboNotationId}>Notation *</Label>
						<Textarea
							id={comboNotationId}
							value={notation}
							onChange={(e) => setNotation(e.target.value)}
							placeholder="5L > 5L > 236H > 623M"
							rows={3}
							className="font-mono"
						/>
						<div className="flex flex-wrap items-center gap-1.5 mt-1.5">
							<span className="text-xs text-muted-foreground">
								Available buttons:
							</span>
							{game.buttonLayout.map((btn) => (
								<span
									key={btn}
									className="px-2 py-0.5 text-xs font-mono bg-muted rounded"
								>
									{btn}
								</span>
							))}
						</div>
					</div>

					{notation && (
						<div className="p-4 bg-muted rounded-lg">
							<Label className="mb-2 block">Preview</Label>
							<ComboDisplay
								tokens={parseComboNotation(notation, game.buttonLayout)}
								game={game}
							/>
						</div>
					)}

					<div className="grid grid-cols-3 gap-4">
						<div className="min-w-0">
							<Label>Difficulty</Label>
							<Select value={difficulty} onValueChange={setDifficulty}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">1 / 5</SelectItem>
									<SelectItem value="2">2 / 5</SelectItem>
									<SelectItem value="3">3 / 5</SelectItem>
									<SelectItem value="4">4 / 5</SelectItem>
									<SelectItem value="5">5 / 5</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="min-w-0">
							<Label htmlFor={comboDamageId}>Damage</Label>
							<Input
								id={comboDamageId}
								value={damage}
								onChange={(e) => setDamage(e.target.value)}
								placeholder="4200"
							/>
						</div>
						<div className="min-w-0">
							<Label htmlFor={comboMeterId}>Meter Cost</Label>
							<Input
								id={comboMeterId}
								value={meterCost}
								onChange={(e) => setMeterCost(e.target.value)}
								placeholder="1 bar"
							/>
						</div>
					</div>

					<div>
						<Label>Tags</Label>
						<div className="flex flex-wrap items-center gap-1.5 p-2 border border-input rounded-md bg-background min-h-[40px] focus-within:ring-2 focus-within:ring-ring">
							{currentTags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="gap-1 cursor-pointer shrink-0"
									onClick={() => removeTag(tag)}
								>
									{tag}
									<X className="w-3 h-3" />
								</Badge>
							))}
							<input
								list={tagSuggestionsId}
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={handleTagKeyDown}
								onBlur={() => {
									if (tagInput.trim()) commitTag(tagInput);
								}}
								placeholder={
									currentTags.length > 0
										? 'Add tag...'
										: 'BnB, Corner, Meterless'
								}
								className="flex-1 min-w-[100px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
							/>
							<datalist id={tagSuggestionsId}>
								{tagSuggestions.map((tag) => (
									<option key={tag} value={tag} />
								))}
							</datalist>
						</div>
					</div>

					<div>
						<Label>Demo Video</Label>
						<div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
							<Input
								value={demoUrl.startsWith('local:') ? '' : demoUrl}
								onChange={(e) => {
									setDemoUrl(e.target.value);
									setDemoFileName('');
								}}
								placeholder="Paste a YouTube URL"
								disabled={demoUrl.startsWith('local:')}
							/>
							<span className="text-xs text-muted-foreground font-medium">
								OR
							</span>
							<Button
								type="button"
								variant="outline"
								onClick={handleVideoFileSelect}
								className="gap-2"
							>
								<VideoCamera className="w-4 h-4" />
								Upload File
							</Button>
						</div>
						{demoUrl && (
							<div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md min-w-0 overflow-hidden">
								<Play className="w-4 h-4 text-primary shrink-0" weight="fill" />
								<span className="text-xs text-muted-foreground truncate min-w-0">
									{demoUrl.startsWith('local:')
										? demoFileName || 'Local video'
										: demoVideoTitle || demoUrl}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2 shrink-0"
									onClick={() => {
										setDemoUrl('');
										setDemoFileName('');
										setDemoVideoTitle('');
									}}
								>
									<X className="w-3 h-3" />
								</Button>
							</div>
						)}
					</div>

					<div>
						<Label htmlFor={comboDescriptionId}>Description</Label>
						<Textarea
							id={comboDescriptionId}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
							placeholder="Works in the corner after any starter..."
						/>
					</div>

					<div className="flex items-center justify-between rounded-lg border border-border p-3">
						<div className="space-y-0.5">
							<Label htmlFor="outdated-toggle" className="text-sm font-medium">Mark as outdated</Label>
							<p className="text-xs text-muted-foreground">
								Flag this combo as potentially outdated due to a game patch
							</p>
						</div>
						<Switch
							id="outdated-toggle"
							checked={outdated}
							onCheckedChange={setOutdated}
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => {
								onOpenChange(false);
								resetForm();
							}}
						>
							Cancel
						</Button>
						<Button onClick={editingCombo ? handleUpdate : handleAdd}>
							{editingCombo ? 'Update' : 'Add'} Combo
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
