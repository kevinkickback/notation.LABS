import {
  GearSixIcon,
  InfoIcon,
  PaletteIcon,
  TextAaIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/useIsMobile';
import { AboutTab } from './AboutTab';
import { ColorCustomization } from './ColorCustomization';
import { GeneralSettings } from './GeneralSettings';
import { NotationSettings } from './NotationSettings';

const TAB_TRIGGER_CLS = 'cursor-pointer transition-colors';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const isMobile = useIsMobile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog max-w-[691px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage application preferences, appearance, notation, and update
            behavior.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="general"
          orientation={isMobile ? 'horizontal' : 'vertical'}
          className="settings-layout min-w-0 min-h-0"
        >
          <TabsList
            aria-label="Settings categories"
            className="settings-navigation"
          >
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
