import type { DisplayMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { TextAlignLeft, Images } from '@phosphor-icons/react';
import type { ReactElement } from 'react';

interface DisplayModeToggleProps {
	mode: DisplayMode;
	onChange: (mode: DisplayMode) => void;
	className?: string;
}

export function DisplayModeToggle({
	mode,
	onChange,
	className = '',
}: DisplayModeToggleProps) {
	const modes: { value: DisplayMode; label: string; icon: ReactElement }[] = [
		{
			value: 'colored-text',
			label: 'Text',
			icon: <TextAlignLeft weight="bold" />,
		},
		{
			value: 'visual-icons',
			label: 'Icons',
			icon: <Images weight="bold" />,
		},
	];

	return (
		<div className={`inline-flex bg-muted rounded-lg p-1 gap-1 ${className}`}>
			{modes.map((m) => (
				<Button
					key={m.value}
					variant={mode === m.value ? 'default' : 'ghost'}
					size="sm"
					onClick={() => onChange(m.value)}
					className="gap-2 min-w-[100px]"
				>
					{m.icon}
					{m.label}
				</Button>
			))}
		</div>
	);
}
