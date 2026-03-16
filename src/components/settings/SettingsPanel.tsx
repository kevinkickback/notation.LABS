import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GearSix, Palette, TextAa, Info } from '@phosphor-icons/react';
import { ColorCustomization } from './ColorCustomization';
import { NotationSettings } from './NotationSettings';
import { GeneralSettings } from './GeneralSettings';
import { AboutTab } from './AboutTab';

interface SettingsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
				<DialogHeader>
					<DialogTitle className="text-2xl">Settings</DialogTitle>
				</DialogHeader>

				<Tabs defaultValue="general" className="gap-6 min-w-0">
					<TabsList className="w-full">
						<TabsTrigger
							value="general"
							className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
						>
							<GearSix className="w-4 h-4" />
							General
						</TabsTrigger>
						<TabsTrigger
							value="colors"
							className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
						>
							<Palette className="w-4 h-4" />
							Colors
						</TabsTrigger>
						<TabsTrigger
							value="notation"
							className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
						>
							<TextAa className="w-4 h-4" />
							Notation
						</TabsTrigger>
						<TabsTrigger
							value="about"
							className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
						>
							<Info className="w-4 h-4" />
							About
						</TabsTrigger>
					</TabsList>
					<TabsContent value="general">
						<GeneralSettings />
					</TabsContent>
					<TabsContent value="colors">
						<ColorCustomization />
					</TabsContent>
					<TabsContent value="notation">
						<NotationSettings />
					</TabsContent>
					<TabsContent value="about">
						<AboutTab />
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
