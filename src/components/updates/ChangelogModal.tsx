import { ArrowSquareOut, CircleNotch } from '@phosphor-icons/react';
import Markdown from 'react-markdown';

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
	loading?: boolean;
	onInstall?: () => void;
}

export function ChangelogModal({
	open,
	onOpenChange,
	version,
	changelog,
	loading = false,
	onInstall,
}: ChangelogModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-xs sm:max-w-md p-3 sm:p-6">
				<DialogHeader>
					<DialogTitle>
						{onInstall
							? `Update Available — v${version}`
							: `Changelog — v${version}`}
					</DialogTitle>
					<DialogDescription>
						{onInstall
							? 'A new version is ready to install. Review the changes below.'
							: 'Changes included in this version.'}
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-64 rounded-md border p-4">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<CircleNotch className="w-6 h-6 animate-spin text-muted-foreground" />
						</div>
					) : changelog ? (
						<div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-muted-foreground [&_p]:my-1 [&_li]:text-muted-foreground [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-foreground [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
							<Markdown
								allowedElements={['p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'strong', 'em', 'code', 'a', 'br', 'blockquote', 'pre']}
								unwrapDisallowed
							>{changelog}</Markdown>
						</div>
					) : (
						<div className="text-sm text-muted-foreground space-y-2">
							<p>No changelog available for this release.</p>
							<a
								href={`https://github.com/kevinkickback/notation.LABS/releases/tag/v${version}`}
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
					{onInstall ? (
						<>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Skip
							</Button>
							<Button onClick={onInstall}>Install Now</Button>
						</>
					) : (
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
