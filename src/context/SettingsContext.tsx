import { SpinnerGapIcon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { reportError, toUserMessage } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { UserSettings } from '@/lib/types';

const SettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);

function ReparseProgressModal() {
  return (
    <Dialog open>
      <DialogContent
        className="max-w-xs sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Updating Combo Parsing...</DialogTitle>
          <DialogDescription>
            notation.LABS is updating stored combos to match the latest notation
            parser. Please wait.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <SpinnerGapIcon className="size-5 animate-spin" />
          <span>Editing is temporarily disabled during this update.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isReparsing, setIsReparsing] = useState(false);

  // Run initialization and data migrations once at mount, outside
  // the useLiveQuery read-only transaction context.
  useEffect(() => {
    indexedDbStorage.settings
      .init({
        onReparseStart: () => setIsReparsing(true),
        onReparseEnd: () => setIsReparsing(false),
      })
      .catch((err) => {
        reportError('SettingsProvider.init', err);
        toast.error(`Failed to load saved settings: ${toUserMessage(err)}`);
      });
  }, []);

  // Pure read - safe inside useLiveQuery.
  const settings = useLiveQuery(
    indexedDbStorage.settings.get,
    [],
    DEFAULT_SETTINGS,
  );

  return (
    <SettingsContext.Provider value={settings ?? DEFAULT_SETTINGS}>
      {children}
      {isReparsing && <ReparseProgressModal />}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
