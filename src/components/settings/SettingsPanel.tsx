import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GearSixIcon,
  PaletteIcon,
  TextAaIcon,
  InfoIcon,
} from '@phosphor-icons/react';
import { ColorCustomization } from './ColorCustomization';
import { NotationSettings } from './NotationSettings';
import { GeneralSettings } from './GeneralSettings';
import { AboutTab } from './AboutTab';

const TAB_TRIGGER_CLS =
  'cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors';

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
          <DialogDescription>
            Manage application preferences, appearance, notation, and update
            behavior.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="gap-6 min-w-0">
          <TabsList className="w-full">
            <TabsTrigger value="general" className={TAB_TRIGGER_CLS}>
              <GearSixIcon className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="colors" className={TAB_TRIGGER_CLS}>
              <PaletteIcon className="w-4 h-4" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="notation" className={TAB_TRIGGER_CLS}>
              <TextAaIcon className="w-4 h-4" />
              Notation
            </TabsTrigger>
            <TabsTrigger value="about" className={TAB_TRIGGER_CLS}>
              <InfoIcon className="w-4 h-4" />
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
