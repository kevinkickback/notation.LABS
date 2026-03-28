import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { getFontFamilyCSS } from '@/components/settings/GeneralSettings';
import { GameLibrary } from '@/components/game/GameLibrary';
import { CharacterView } from '@/components/character/CharacterView';
import { ComboView } from '@/components/combo/ComboView';
import { Header } from '@/components/layout/Header';
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar';
import { ChangelogModal } from '@/components/layout/ChangelogModal';
import { UpdateProgressModal } from '@/components/layout/UpdateProgressModal';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

function App() {
	const { selectedGameId, selectedCharacterId } = useAppStore();
	const [initialized, setInitialized] = useState(false);
	const settings = useSettings();

	const [autoUpdateVersion, setAutoUpdateVersion] = useState<string | null>(
		null,
	);
	const [autoUpdateChangelog, setAutoUpdateChangelog] = useState<string | null>(
		null,
	);
	const [showAutoChangelog, setShowAutoChangelog] = useState(false);
	const [showAutoProgress, setShowAutoProgress] = useState(false);

	useEffect(() => {
		setInitialized(true);
	}, []);

	useEffect(() => {
		document.documentElement.style.setProperty(
			'--app-font-family',
			getFontFamilyCSS(settings.fontFamily),
		);
	}, [settings.fontFamily]);

	useEffect(() => {
		if (settings.accentColor) {
			document.documentElement.style.setProperty(
				'--accent-color',
				settings.accentColor,
			);
		} else {
			document.documentElement.style.setProperty('--accent-color', '#3b82f6');
		}
	}, [settings.accentColor]);

	useEffect(() => {
		if (settings.colorTheme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, [settings.colorTheme]);

	useEffect(() => {
		if (!window.electronAPI?.onUpdateAvailable) return;

		const unsub = window.electronAPI.onUpdateAvailable((data) => {
			setAutoUpdateVersion(data.version);
			setAutoUpdateChangelog(data.changelog);
			toast.info(`Update v${data.version} available`, {
				action: {
					label: 'View',
					onClick: () => setShowAutoChangelog(true),
				},
				duration: 10000,
			});
		});

		if (settings.autoUpdate && window.electronAPI.setAutoCheck) {
			window.electronAPI.setAutoCheck(true);
		}

		return unsub;
	}, [settings.autoUpdate]);

	const handleAutoInstall = useCallback(() => {
		setShowAutoChangelog(false);
		setShowAutoProgress(true);
		if (window.electronAPI?.downloadUpdate) {
			window.electronAPI.downloadUpdate();
		}
	}, []);

	const games = useLiveQuery(() => db.games.toArray(), []);
	const characters = useLiveQuery(
		() =>
			selectedGameId
				? db.characters.where('gameId').equals(selectedGameId).toArray()
				: [],
		[selectedGameId],
	);
	const combos = useLiveQuery(
		() =>
			selectedCharacterId
				? db.combos
						.where('characterId')
						.equals(selectedCharacterId)
						.sortBy('sortOrder')
				: [],
		[selectedCharacterId],
	);

	const selectedGame = games?.find((g) => g.id === selectedGameId);
	const selectedCharacter = characters?.find(
		(c) => c.id === selectedCharacterId,
	);

	if (!initialized) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Header />
			<BreadcrumbBar
				selectedGame={selectedGame}
				selectedCharacter={selectedCharacter}
			/>

			<main className="container mx-auto px-4 py-8">
				{!selectedGameId && <GameLibrary games={games || []} />}

				{selectedGameId && !selectedCharacterId && selectedGame && (
					<CharacterView game={selectedGame} characters={characters || []} />
				)}

				{selectedCharacterId && selectedGame && selectedCharacter && (
					<ComboView
						game={selectedGame}
						character={selectedCharacter}
						combos={combos || []}
					/>
				)}
			</main>

			<Toaster />

			<ChangelogModal
				open={showAutoChangelog}
				onOpenChange={setShowAutoChangelog}
				version={autoUpdateVersion ?? ''}
				changelog={autoUpdateChangelog}
				onInstall={handleAutoInstall}
			/>

			<UpdateProgressModal
				open={showAutoProgress}
				version={autoUpdateVersion ?? ''}
			/>
		</div>
	);
}

export default App;
