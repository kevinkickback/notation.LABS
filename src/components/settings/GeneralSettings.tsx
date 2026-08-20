import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  ScrollIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettings, useSettingsActions } from '@/context/SettingsContext';
import { useUpdater } from '@/context/UpdaterContext';
import { FONT_OPTIONS } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import type { FontFamily } from '@/lib/types';

export function GeneralSettings() {
  const settings = useSettings();
  const { setSetting } = useSettingsActions();
  const {
    status: updaterStatus,
    checkForUpdate,
    showAvailableUpdate,
    showChangelog,
    dismissChangelog,
  } = useUpdater();
  const [accentDraft, setAccentDraft] = useState<string>(
    settings.accentColor || '#3b82f6',
  );
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const updateChecking = updaterStatus.status === 'checking';
  const updateStatus =
    updaterStatus.status === 'not-available'
      ? 'up-to-date'
      : updaterStatus.status === 'available' || updaterStatus.status === 'error'
        ? updaterStatus.status
        : 'idle';

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI
        .getAppVersion()
        .then(setAppVersion)
        .catch((err) => {
          reportError('GeneralSettings.getAppVersion', err);
        });
    }
  }, []);

  useEffect(() => {
    setAccentDraft(settings.accentColor || '#3b82f6');
  }, [settings.accentColor]);

  const handleCheckForUpdate = async () => {
    try {
      const status = await checkForUpdate();
      if (status.status === 'available') {
        showAvailableUpdate(status);
        return;
      }

      if (status.status === 'error') {
        toast.error(status.error || 'Could not check for updates.');
        return;
      }
    } catch {
      toast.error('Could not check for updates. Please try again.');
    }
  };

  const fetchCurrentChangelogFromWeb = useCallback(async () => {
    const version = __APP_VERSION__;
    const tag = `v${version}`;
    const apiUrl = `https://api.github.com/repos/kevinkickback/notation.LABS/releases/tags/${tag}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'notation-labs-web',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch changelog (${res.status} ${res.statusText})`,
      );
    }

    const data = await res.json();
    if (typeof data.body !== 'string') {
      throw new Error('Changelog is not available in release body');
    }

    return {
      version,
      changelog: data.body,
    };
  }, []);

  const handleViewCurrentChangelog = useCallback(async () => {
    setChangelogLoading(true);
    showChangelog({
      version: appVersion ?? __APP_VERSION__,
      changelog: null,
      loading: true,
    });

    try {
      if (window.electronAPI?.getCurrentChangelog) {
        const result = await window.electronAPI.getCurrentChangelog();
        setAppVersion(result.version);
        showChangelog({
          version: result.version,
          changelog: result.changelog ?? null,
        });
        return;
      }

      const result = await fetchCurrentChangelogFromWeb();
      setAppVersion(result.version);
      showChangelog(result);
    } catch (err) {
      dismissChangelog();
      reportError('GeneralSettings.handleViewCurrentChangelog', err);
      toast.error('Failed to load changelog');
    } finally {
      setChangelogLoading(false);
    }
  }, [
    appVersion,
    dismissChangelog,
    fetchCurrentChangelogFromWeb,
    showChangelog,
  ]);

  return (
    <div className="space-y-6">
      {/* Appearance Card - always shown */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Accent Color</Label>
              <p className="text-sm text-muted-foreground">
                Accent for buttons, logo, highlights
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accentColor || '#3b82f6'}
                onChange={(e) => {
                  void setSetting('accentColor', e.target.value);
                }}
                className="w-10 h-10 rounded border border-border shadow-sm cursor-pointer"
                aria-label="Accent color picker"
              />
              <input
                type="text"
                value={accentDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setAccentDraft(value);
                  if (CSS.supports('color', value)) {
                    void setSetting('accentColor', value);
                  }
                }}
                className="text-xs font-mono w-[4.2rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
                aria-label="Accent color hex"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark mode
              </p>
            </div>
            <Select
              value={settings.colorTheme}
              onValueChange={(v) => {
                void setSetting('colorTheme', v as 'light' | 'dark');
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Font</Label>
              <p className="text-sm text-muted-foreground">
                Choose the app font family
              </p>
            </div>
            <Select
              value={settings.fontFamily}
              onValueChange={(v) => {
                const font = v as FontFamily;
                void setSetting('fontFamily', font);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    style={{ fontFamily: opt.style }}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Character Card Orientation</Label>
              <p className="text-sm text-muted-foreground">
                Default aspect ratio for character portrait cards
              </p>
            </div>
            <Select
              value={settings.characterCardOrientation ?? 'landscape'}
              onValueChange={(v) =>
                void setSetting(
                  'characterCardOrientation',
                  v as 'landscape' | 'portrait',
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Updates Card and modals - always shown */}
      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>
            {appVersion
              ? `Current version: v${appVersion}`
              : 'Manage app updates'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeof window !== 'undefined' && window.electronAPI && (
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Update</Label>
                <p className="text-sm text-muted-foreground">
                  Check for updates automatically on launch
                </p>
              </div>
              <Switch
                checked={settings.autoUpdate ?? true}
                onCheckedChange={(v) => {
                  void setSetting('autoUpdate', v);
                  toast.success(
                    v ? 'Auto-update enabled' : 'Auto-update disabled',
                  );
                }}
              />
            </div>
          )}
          {typeof window !== 'undefined' && window.electronAPI && (
            <div className="flex items-center justify-between">
              <div>
                <Label>Check for Updates</Label>
                <p className="text-sm text-muted-foreground">
                  {updateStatus === 'up-to-date' && (
                    <span className="inline-flex items-center gap-1 text-green-500">
                      <CheckCircleIcon size={14} weight="fill" /> Up to date
                    </span>
                  )}
                  {updateStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <WarningCircleIcon size={14} weight="fill" /> Check failed
                    </span>
                  )}
                  {updateStatus === 'available' && updaterStatus.version && (
                    <span className="text-primary">
                      v{updaterStatus.version} available
                    </span>
                  )}
                  {updateStatus === 'idle' &&
                    'Manually check for a new version'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckForUpdate}
                disabled={updateChecking}
              >
                {updateChecking ? (
                  <SpinnerGapIcon size={16} className="animate-spin mr-1" />
                ) : (
                  <ArrowsClockwiseIcon size={16} className="mr-1" />
                )}
                {updateChecking ? 'Checking...' : 'Check Now'}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label>Changelog</Label>
              <p className="text-sm text-muted-foreground">
                View what's new in the current version
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={changelogLoading}
              onClick={handleViewCurrentChangelog}
            >
              <ScrollIcon size={16} className="mr-1" /> View
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Behavior Card - always shown */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
          <CardDescription>
            Configure app behavior and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Confirm Before Delete</Label>
              <p className="text-sm text-muted-foreground">
                Show a confirmation dialog before deleting items
              </p>
            </div>
            <Switch
              checked={settings.confirmBeforeDelete ?? true}
              onCheckedChange={(v) => {
                void setSetting('confirmBeforeDelete', v);
                toast.success(
                  v
                    ? 'Delete confirmation enabled'
                    : 'Delete confirmation disabled',
                );
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notes Open by Default</Label>
              <p className="text-sm text-muted-foreground">
                Show notes panels expanded when navigating to a game or
                character
              </p>
            </div>
            <Switch
              checked={settings.notesDefaultOpen ?? false}
              onCheckedChange={(v) => void setSetting('notesDefaultOpen', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
