import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { X } from '@phosphor-icons/react';

interface ComboFiltersProps {
	filterSearch: string;
	onFilterSearchChange: (value: string) => void;
	filterTags: string[];
	onToggleFilterTag: (tag: string) => void;
	filterDifficulty: string;
	onFilterDifficultyChange: (value: string) => void;
	filterOutdated: 'all' | 'outdated' | 'current';
	onFilterOutdatedChange: (value: 'all' | 'outdated' | 'current') => void;
	allTags: string[];
	hasActiveFilters: boolean;
	onClearFilters: () => void;
	filteredCount: number;
	totalCount: number;
}

export function ComboFilters({
	filterSearch,
	onFilterSearchChange,
	filterTags,
	onToggleFilterTag,
	filterDifficulty,
	onFilterDifficultyChange,
	filterOutdated,
	onFilterOutdatedChange,
	allTags,
	hasActiveFilters,
	onClearFilters,
	filteredCount,
	totalCount,
}: ComboFiltersProps) {
	return (
		<div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-lg">
			<Input
				placeholder="Search combos..."
				value={filterSearch}
				onChange={(e) => onFilterSearchChange(e.target.value)}
				className="w-48"
			/>
			{allTags.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					{allTags.map((tag) => (
						<Badge
							key={tag}
							variant={filterTags.includes(tag) ? 'default' : 'outline'}
							className="cursor-pointer select-none"
							onClick={() => onToggleFilterTag(tag)}
						>
							#{tag}
							{filterTags.includes(tag) && <X className="w-3 h-3 ml-1" />}
						</Badge>
					))}
				</div>
			)}
			<Select value={filterDifficulty} onValueChange={onFilterDifficultyChange}>
				<SelectTrigger className="w-40">
					<SelectValue placeholder="Difficulty" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Difficulties</SelectItem>
					<SelectItem value="1">1 / 5</SelectItem>
					<SelectItem value="2">2 / 5</SelectItem>
					<SelectItem value="3">3 / 5</SelectItem>
					<SelectItem value="4">4 / 5</SelectItem>
					<SelectItem value="5">5 / 5</SelectItem>
				</SelectContent>
			</Select>
			<Select value={filterOutdated} onValueChange={(v) => onFilterOutdatedChange(v as 'all' | 'outdated' | 'current')}>
				<SelectTrigger className="w-36">
					<SelectValue placeholder="Status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Status</SelectItem>
					<SelectItem value="outdated">Outdated</SelectItem>
					<SelectItem value="current">Current</SelectItem>
				</SelectContent>
			</Select>
			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearFilters}
					className="gap-1"
				>
					<X className="w-4 h-4" />
					Clear
				</Button>
			)}
			{hasActiveFilters && (
				<span className="text-sm text-muted-foreground ml-auto">
					{filteredCount} of {totalCount} combos
				</span>
			)}
		</div>
	);
}
