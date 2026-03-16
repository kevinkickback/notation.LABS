import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@phosphor-icons/react';
import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { Game, Character } from '@/lib/types';

interface BreadcrumbBarProps {
	selectedGame?: Game;
	selectedCharacter?: Character;
}

export function BreadcrumbBar({
	selectedGame,
	selectedCharacter,
}: BreadcrumbBarProps) {
	const {
		selectedGameId,
		selectedCharacterId,
		setSelectedGame,
		setSelectedCharacter,
	} = useAppStore();

	if (!selectedGameId) return null;

	const handleBack = () => {
		if (selectedCharacterId) {
			setSelectedCharacter(null);
		} else if (selectedGameId) {
			setSelectedGame(null);
		}
	};

	return (
		<div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-[65px] z-40">
			<div className="container mx-auto px-4 py-2 flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={handleBack}
				>
					<ArrowLeft className="size-5" />
				</Button>

				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							{selectedGameId ? (
								<BreadcrumbLink
									className="cursor-pointer"
									onClick={() => setSelectedGame(null)}
								>
									Games
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage>Games</BreadcrumbPage>
							)}
						</BreadcrumbItem>

						{selectedGame && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									{selectedCharacterId ? (
										<BreadcrumbLink
											className="cursor-pointer"
											onClick={() => setSelectedCharacter(null)}
										>
											{selectedGame.name}
										</BreadcrumbLink>
									) : (
										<BreadcrumbPage>{selectedGame.name}</BreadcrumbPage>
									)}
								</BreadcrumbItem>
							</>
						)}

						{selectedCharacter && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>{selectedCharacter.name}</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						)}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</div>
	);
}
