import { ArrowSquareOut } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChangelogModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	version: string;
	changelog: string | null;
	onInstall: () => void;
}

function renderChangelog(markdown: string): ReactNode[] {
	const lines = markdown.split('\n');
	const elements: ReactNode[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('## ')) {
			elements.push(
				<h3 key={i} className="text-sm font-semibold mt-4 mb-2 text-foreground">
					{line.replace('## ', '')}
				</h3>,
			);
		} else if (line.startsWith('- ')) {
			elements.push(
				<li key={i} className="text-sm text-muted-foreground ml-4 list-disc">
					{line.replace('- ', '')}
				</li>,
			);
		} else if (!line.startsWith('# ') && line.trim() !== '') {
			elements.push(
				<p key={i} className="text-sm text-muted-foreground">
					{line}
				</p>,
			);
		}
	}

	return elements;
}

export function ChangelogModal({
	open,
	onOpenChange,
	version,
	changelog,
	onInstall,
}: ChangelogModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Update Available — v{version}</DialogTitle>
					<DialogDescription>
						A new version is ready to install. Review the changes below.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-64 rounded-md border p-4">
					{changelog ? (
						<ul className="space-y-1">{renderChangelog(changelog)}</ul>
					) : (
						<div className="text-sm text-muted-foreground space-y-2">
							<p>No changelog available for this release.</p>
							<a
								href={`https://github.com/your-github-org/loopdex/releases/tag/v${version}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-primary hover:underline"
							>
								View release on GitHub <ArrowSquareOut size={14} />
							</a>
						</div>
					)}
				</ScrollArea>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Skip
					</Button>
					<Button onClick={onInstall}>Install Now</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
