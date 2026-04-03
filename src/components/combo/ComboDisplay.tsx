import { useMemo } from 'react';
import type { ComboToken, Game, NotationColors } from '@/lib/types';
import { getTokenColor } from '@/lib/parser';
import { useSettings } from '@/context/SettingsContext';
import { MotionIcon } from './icons/MotionIcon';
import { ButtonIcon } from './icons/ButtonIcon';
import { CounterHitIcon } from './icons/CounterHitIcon';

const REPEAT_PAREN_COLOR = 'oklch(0.65 0.02 265)';

const DIRECTION_MODIFIERS: Record<string, string> = {
	'st.': '5',
	'cr.': '2',
	'b.': '4',
	'db.': '1',
	'df.': '3',
	'f.': '6',
	'ub.': '7',
	'u.': '8',
	'uf.': '9',
	dash: '66',
};

function getRepeatParenIndices(tokens: ComboToken[]): Set<number> {
	const showParens = new Set<number>();
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type === 'repeat-start') {
			let innerCount = 0;
			let endIdx = -1;
			for (let j = i + 1; j < tokens.length; j++) {
				if (tokens[j].type === 'repeat-end') {
					endIdx = j;
					break;
				}
				if (tokens[j].type !== 'separator') {
					innerCount++;
				}
			}
			if (innerCount > 1 && endIdx !== -1) {
				showParens.add(i);
				showParens.add(endIdx);
			}
		}
	}
	return showParens;
}

function groupTokensWithButtons(
	tokens: ComboToken[],
	colors: NotationColors,
	buttonColors?: Record<string, string>,
): Array<{ tokens: ComboToken[]; buttonColor?: string }> {
	const groups: Array<{ tokens: ComboToken[]; buttonColor?: string }> = [];
	let currentGroup: ComboToken[] = [];
	let pendingButton: ComboToken | null = null;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		if (token.type === 'separator') {
			if (pendingButton) {
				const buttonColor = getTokenColor(pendingButton, colors, buttonColors);
				groups.push({ tokens: currentGroup, buttonColor });
				currentGroup = [];
				pendingButton = null;
			} else if (currentGroup.length > 0) {
				groups.push({ tokens: currentGroup });
				currentGroup = [];
			}
			groups.push({ tokens: [token] });
		} else if (token.type === 'button') {
			pendingButton = token;
			currentGroup.push(token);
		} else {
			currentGroup.push(token);
		}
	}

	if (currentGroup.length > 0) {
		if (pendingButton) {
			const buttonColor = getTokenColor(pendingButton, colors, buttonColors);
			groups.push({ tokens: currentGroup, buttonColor });
		} else {
			groups.push({ tokens: currentGroup });
		}
	}

	return groups;
}

interface ComboDisplayProps {
	tokens: ComboToken[];
	game?: Game;
	mode?: 'colored-text' | 'visual-icons';
	className?: string;
}

export function ComboDisplay({
	tokens,
	game,
	mode = 'colored-text',
	className = '',
}: ComboDisplayProps) {
	const settings = useSettings();
	const colors = settings.notationColors;
	const comboScale = settings.comboScale ?? 1;
	const iconStyle = settings.iconStyle ?? 'hexagon';

	const repeatParenIndices = useMemo(() => getRepeatParenIndices(tokens), [tokens]);
	const groups = useMemo(
		() => groupTokensWithButtons(tokens, colors, game?.buttonColors),
		[tokens, colors, game?.buttonColors],
	);
	const indexedGroups = useMemo(() => {
		let flatIdx = 0;
		return groups.map((g) => ({
			buttonColor: g.buttonColor,
			tokens: g.tokens.map((t) => ({ token: t, flatIndex: flatIdx++ })),
		}));
	}, [groups]);

	const renderColoredToken = (
		token: ComboToken,
		idx: number,
		groupColor?: string,
	) => {
		const color =
			groupColor || getTokenColor(token, colors, game?.buttonColors);

		if (token.type === 'repeat-start') {
			if (!repeatParenIndices.has(idx)) return null;
			return (
				<span
					key={idx}
					style={{ color: REPEAT_PAREN_COLOR }}
					className="font-medium tracking-tight"
				>
					(
				</span>
			);
		}

		if (token.type === 'repeat-end') {
			const showParen = repeatParenIndices.has(idx);
			return (
				<span key={idx} className="inline-flex items-baseline">
					{showParen && (
						<span
							style={{ color: REPEAT_PAREN_COLOR }}
							className="font-medium tracking-tight"
						>
							)
						</span>
					)}
					<sup
						style={{ color: REPEAT_PAREN_COLOR }}
						className="font-medium text-xs ml-0.5"
					>
						×{token.repeatCount}
					</sup>
				</span>
			);
		}

		const isCH = token.type === 'modifier' && token.value === 'CH';
		const isParenAnnotation =
			token.type === 'modifier' && token.value.startsWith('(');

		return (
			<span
				key={idx}
				style={{ color }}
				className={
					token.type === 'separator'
						? 'font-medium tracking-tight mx-1'
						: isCH || isParenAnnotation
							? 'font-medium tracking-tight mx-1'
							: 'font-medium tracking-tight'
				}
			>
				{token.type === 'motion' ? token.rawValue : token.value}
			</span>
		);
	};

	const renderIconToken = (
		token: ComboToken,
		idx: number,
		groupColor?: string,
	) => {
		const color =
			groupColor || getTokenColor(token, colors, game?.buttonColors);

		if (token.type === 'repeat-start') {
			if (!repeatParenIndices.has(idx)) return null;
			return (
				<span
					key={idx}
					style={{ color: REPEAT_PAREN_COLOR }}
					className="font-medium text-lg"
				>
					(
				</span>
			);
		}

		if (token.type === 'repeat-end') {
			const showParen = repeatParenIndices.has(idx);
			return (
				<span key={idx} className="inline-flex items-baseline">
					{showParen && (
						<span
							style={{ color: REPEAT_PAREN_COLOR }}
							className="font-medium text-lg"
						>
							)
						</span>
					)}
					<sup
						style={{ color: REPEAT_PAREN_COLOR }}
						className="font-medium text-xs ml-0.5"
					>
						×{token.repeatCount}
					</sup>
				</span>
			);
		}

		switch (token.type) {
			case 'motion':
				return (
					<MotionIcon
						key={idx}
						motion={token.value}
						size={Math.round(40 * comboScale)}
						color={color}
					/>
				);
			case 'direction':
				if (token.value === '5') {
					return null;
				}
				return (
					<MotionIcon
						key={idx}
						motion={token.value}
						size={Math.round(40 * comboScale)}
						color={color}
					/>
				);
			case 'button':
				return (
					<ButtonIcon
						key={idx}
						button={token.value}
						size={Math.round(30 * comboScale)}
						color={color}
						iconStyle={iconStyle}
					/>
				);
			case 'modifier': {
				if (token.value === 'CH') {
					return (
						<CounterHitIcon
							key={idx}
							size={Math.round(30 * comboScale)}
							color={color}
						/>
					);
				}
				const dirNum = DIRECTION_MODIFIERS[token.value.toLowerCase()];
				if (dirNum) {
					if (dirNum === '5') return null;
					return (
						<MotionIcon
							key={idx}
							motion={dirNum}
							size={Math.round(40 * comboScale)}
							color={color}
						/>
					);
				}
				return (
					<span
						key={idx}
						className={`font-medium tracking-tight${token.value.startsWith('(') ? ' mx-1' : ''}`}
						style={{ color, fontSize: `${1.25 * comboScale}rem` }}
					>
						{token.value}
					</span>
				);
			}
			case 'separator':
				return (
					<span
						key={idx}
						className="font-bold opacity-50 mx-1"
						style={{ color, fontSize: `${1.5 * comboScale}rem` }}
					>
						{token.value === '>' ? '→' : token.value}
					</span>
				);
			default:
				return (
					<span key={idx} className="font-mono" style={{ color, fontSize: `${1 * comboScale}rem` }}>
						{token.value}
					</span>
				);
		}
	};

	if (mode === 'colored-text') {
		return (
			<div
				className={`flex flex-wrap items-center font-mono ${className}`}
				style={{ fontSize: `${1.125 * comboScale}rem` }}
			>
				{indexedGroups.map((group, groupIdx) => {
					const groupKey = `${groupIdx}-${group.tokens.map(({ token }) => token.value).join('')}`;
					return (
						<div key={groupKey} className="flex items-center">
							{group.tokens.map(({ token, flatIndex }) =>
								renderColoredToken(token, flatIndex, group.buttonColor),
							)}
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			{indexedGroups.map((group, groupIdx) => {
				const groupKey = `${groupIdx}-${group.tokens.map(({ token }) => token.value).join('')}`;
				return (
					<div key={groupKey} className="flex items-center gap-1">
						{group.tokens.map(({ token, flatIndex }) =>
							renderIconToken(token, flatIndex, group.buttonColor),
						)}
					</div>
				);
			})}
		</div>
	);
}
