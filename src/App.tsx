import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';
import { useSettings } from '@/hooks/useSettings';
import { getFontFamilyCSS } from '@/lib/defaults';
import { GameLibrary } from '@/components/game/GameLibrary';
import { CharacterView } from '@/components/character/CharacterView';
import { ComboView } from '@/components/combo/ComboView';
import { Header } from '@/components/header/Header';
import { BreadcrumbBar } from '@/components/header/BreadcrumbBar';
import { ChangelogModal } from '@/components/updates/ChangelogModal';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

function App() {
	const { selectedGameId, selectedCharacterId } = useAppStore();
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
		document.documentElement.style.setProperty(
			'--app-font-family',
			getFontFamilyCSS(settings.fontFamily),
		);
		document.documentElement.style.setProperty(
			'--accent-color',
			settings.accentColor || '#3b82f6',
		);
		document.documentElement.classList.toggle(
			'dark',
			settings.colorTheme === 'dark',
		);
	}, [settings.fontFamily, settings.accentColor, settings.colorTheme]);

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

	const games = useLiveQuery(indexedDbStorage.games.getAll, []);
	const characters = useLiveQuery(
		() =>
			selectedGameId
				? indexedDbStorage.characters.getByGame(selectedGameId)
				: [],
		[selectedGameId],
	);
	const combos = useLiveQuery(
		() =>
			selectedCharacterId
				? indexedDbStorage.combos.getByCharacter(selectedCharacterId)
				: [],
		[selectedCharacterId],
	);

	const selectedGame = games?.find((g) => g.id === selectedGameId);
	const selectedCharacter = characters?.find(
		(c) => c.id === selectedCharacterId,
	);

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
				onOpenChange={setShowAutoProgress}
			/>
		</div>
	);
}

export default App;
