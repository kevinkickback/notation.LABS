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
		<div className={`inline-flex items-center rounded-md ${className}`}>
			{modes.map((m, i) => (
				<Button
					key={m.value}
					variant={mode === m.value ? 'secondary' : 'ghost'}
					onClick={() => onChange(m.value)}
					className={`h-9 px-2 flex items-center gap-1.5 ${i === 0 ? 'rounded-r-none' : 'rounded-l-none'}`}
					title={m.label}
				>
					{m.icon}
					<span className="text-xs leading-tight">{m.label}</span>
				</Button>
			))}
		</div>
	);
}
