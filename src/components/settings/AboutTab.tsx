import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

const FGC_RESOURCES = [
	{
		name: 'Dustloop',
		url: 'https://www.dustloop.com',
		description:
			'Comprehensive frame data and combo guides for Arc System Works games',
	},
	{
		name: 'Mizuumi Wiki',
		url: 'https://wiki.gbl.gg',
		description: 'Community wiki for niche and indie fighting games',
	},
	{
		name: 'SuperCombo Wiki',
		url: 'https://wiki.supercombo.gg',
		description: 'Strategy guides and resources for competitive fighting games',
	},
	{
		name: "Infil's FG Glossary",
		url: 'https://glossary.infil.net',
		description: 'Fighting game terminology explained',
	},
	{
		name: 'FGC Reddit',
		url: 'https://www.reddit.com/r/Fighters',
		description: 'Community hub for fighting game discussion',
	},
];

export function AboutTab() {
	const [appVersion, setAppVersion] = useState<string>('');
	const currentYear = new Date().getFullYear();

	useEffect(() => {
		window.electronAPI?.getAppVersion().then(setAppVersion);
	}, []);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>notation.LABS</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center gap-6 text-sm">
						<div>
							<span className="text-muted-foreground">Version:</span>{' '}
							<span className="font-medium">{appVersion}</span>
						</div>
						<div>
							<span className="text-muted-foreground">Electron:</span>{' '}
							<span className="font-medium">
								{window.electronAPI?.versions?.electron ?? 'N/A'}
							</span>
						</div>
						<div>
							<span className="text-muted-foreground">Chrome:</span>{' '}
							<span className="font-medium">
								{window.electronAPI?.versions?.chrome ?? 'N/A'}
							</span>
						</div>
					</div>
					<p className="text-sm text-muted-foreground">
						A combo tracker and notation tool for fighting game players. Record,
						organize, and practice your combos across multiple games and
						characters.
					</p>
					<p className="text-xs text-muted-foreground">
						&copy; {currentYear} Notation Labs. All rights reserved.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>FGC Resources</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{FGC_RESOURCES.map((resource) => (
							<a
								key={resource.name}
								href={resource.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
							>
								<div className="flex-1">
									<div className="flex items-center gap-1.5">
										<span className="font-medium text-sm group-hover:text-primary transition-colors">
											{resource.name}
										</span>
										<ArrowSquareOut className="w-3.5 h-3.5 text-muted-foreground" />
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										{resource.description}
									</p>
								</div>
							</a>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
