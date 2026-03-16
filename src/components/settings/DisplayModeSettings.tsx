import { useState, useEffect, useCallback } from 'react';
import type { DisplayMode } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { parseComboNotation } from '@/lib/parser';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { useAppStore } from '@/lib/store';

const SAMPLE_COMBO = '5L > 2M > 236H > j.M';

export function DisplayModeSettings() {
	const [displayMode, setDisplayMode] = useState<DisplayMode>('colored-text');
	const [loading, setLoading] = useState(true);

	const loadSettings = useCallback(async () => {
		setLoading(true);
		const settings = await indexedDbStorage.settings.get();
		setDisplayMode(settings.displayMode);
		setLoading(false);
	}, []);

	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		loadSettings();
	}, [loadSettings]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const handleModeChange = async (mode: DisplayMode) => {
		setDisplayMode(mode);
		await indexedDbStorage.settings.update({ displayMode: mode });
		toast.success('Display mode updated');
		useAppStore.getState().notifySettingsChanged();
	};

	const sampleTokens = parseComboNotation(SAMPLE_COMBO);

	if (loading) {
		return <div className="text-sm text-muted-foreground">Loading...</div>;
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Display Mode</CardTitle>
					<CardDescription>
						Choose how combo notation is displayed throughout the app
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<RadioGroup
						value={displayMode}
						onValueChange={(value) => handleModeChange(value as DisplayMode)}
					>
						<div className="space-y-4">
							<div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
								<RadioGroupItem
									value="colored-text"
									id="colored-text"
									className="mt-1"
								/>
								<div className="flex-1 space-y-2">
									<Label
										htmlFor="colored-text"
										className="text-base font-medium cursor-pointer"
									>
										Colored Text
									</Label>
									<p className="text-sm text-muted-foreground">
										Standard notation with color coding for different input
										types
									</p>
									<div className="p-3 bg-muted/30 rounded-md mt-2">
										<ComboDisplay tokens={sampleTokens} mode="colored-text" />
									</div>
								</div>
							</div>

							<div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
								<RadioGroupItem
									value="visual-icons"
									id="visual-icons"
									className="mt-1"
								/>
								<div className="flex-1 space-y-2">
									<Label
										htmlFor="visual-icons"
										className="text-base font-medium cursor-pointer"
									>
										Visual Icons
									</Label>
									<p className="text-sm text-muted-foreground">
										SVG icons representing joystick motions and button presses
									</p>
									<div className="p-3 bg-muted/30 rounded-md mt-2">
										<ComboDisplay tokens={sampleTokens} mode="visual-icons" />
									</div>
								</div>
							</div>
						</div>
					</RadioGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Preview Examples</CardTitle>
					<CardDescription>
						See how different combos appear in the selected display mode
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[
							{ combo: '5L > 5L > 2M > 5H', label: 'Basic BnB' },
							{ combo: '236H > 214L > 623M', label: 'Special Cancel' },
							{ combo: 'j.M > j.H > 5L > 2M > 236H', label: 'Jump-In Combo' },
							{ combo: '2L > 2L > 5M > 236H > 214L', label: 'Low Starter' },
						].map(({ combo, label }) => {
							const tokens = parseComboNotation(combo);
							return (
								<div
									key={label}
									className="p-4 bg-card rounded-lg border border-border"
								>
									<div className="text-sm font-medium text-muted-foreground mb-3">
										{label}
									</div>
									<ComboDisplay tokens={tokens} mode={displayMode} />
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
