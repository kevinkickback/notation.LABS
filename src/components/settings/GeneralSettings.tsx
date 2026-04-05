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
import { ChangelogModal } from '@/components/updates/ChangelogModal';
import { UpdateProgressModal } from '@/components/updates/UpdateProgressModal';
import { useSettings } from '@/context/SettingsContext';
import { FONT_OPTIONS, getFontFamilyCSS } from '@/lib/defaults';
import { reportError } from '@/lib/errors';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { FontFamily, UserSettings } from '@/lib/types';

export function GeneralSettings() {
  const settings = useSettings();
  const [accent, setAccent] = useState<string>(
    settings.accentColor || '#3b82f6',
  );
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'up-to-date' | 'available' | 'error'
  >('idle');
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showCurrentChangelog, setShowCurrentChangelog] = useState(false);
  const [updateChangelog, setUpdateChangelog] = useState('');
  const [currentChangelog, setCurrentChangelog] = useState('');
  const [changelogLoading, setChangelogLoading] = useState(false);

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
    setAccent(settings.accentColor || '#3b82f6');
  }, [settings.accentColor]);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    await indexedDbStorage.settings.update({ [key]: value });
    if (key === 'accentColor') {
      setAccent(value as string);
    }
  };

  const handleInstallUpdate = useCallback(() => {
    setShowChangelog(false);
    setShowProgress(true);
    if (window.electronAPI?.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    }
  }, []);

  const handleProgressModalOpenChange = useCallback((open: boolean) => {
    setShowProgress(open);
    if (!open) {
      setUpdateStatus('idle');
      setUpdateChecking(false);
    }
  }, []);

  const handleCheckForUpdate = async () => {
    setUpdateChecking(true);
    try {
      const result = await window.electronAPI?.checkForUpdate?.();
      if (!result) {
        setUpdateStatus('error');
        toast.error('Update checks are unavailable in this environment.');
        return;
      }

      if (!result.success) {
        setUpdateStatus('error');
        toast.error(result.error ?? 'Could not check for updates.');
        return;
      }

      if (!result.data) {
        setUpdateStatus('error');
        toast.error('Update check returned an invalid response.');
        return;
      }

      if (result.data.status === 'available') {
        setUpdateStatus('available');
        setUpdateVersion(result.data.version);
        setUpdateChangelog(result.data.changelog ?? '');
        setShowChangelog(true);
        return;
      }

      if (result.data.status === 'not-available') {
        setUpdateStatus('up-to-date');
        return;
      }

      if (result.data.status === 'error') {
        setUpdateStatus('error');
        toast.error(result.data.message || 'Could not check for updates.');
        return;
      }

      setUpdateStatus('error');
      toast.error('Update check returned an invalid response.');
    } catch {
      setUpdateStatus('error');
      toast.error('Could not check for updates. Please try again.');
    } finally {
      setUpdateChecking(false);
    }
  };

  const fetchCurrentChangelogFromWeb = useCallback(async () => {
    let version = __APP_VERSION__;

    try {
      const pkgRes = await fetch('/package.json');
      if (pkgRes.ok) {
        const pkg = await pkgRes.json();
        if (typeof pkg.version === 'string' && pkg.version.trim()) {
          version = pkg.version;
        }
      }
    } catch (err) {
      reportError('GeneralSettings.fetchPackageVersion', err);
    }

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
    setCurrentChangelog('');
    setShowCurrentChangelog(true);
    setChangelogLoading(true);

    try {
      if (window.electronAPI?.getCurrentChangelog) {
        const result = await window.electronAPI.getCurrentChangelog();
        setCurrentChangelog(result.changelog ?? '');
        setAppVersion(result.version);
        return;
      }

      const result = await fetchCurrentChangelogFromWeb();
      setCurrentChangelog(result.changelog);
      setAppVersion(result.version);
    } catch (err) {
      reportError('GeneralSettings.handleViewCurrentChangelog', err);
      toast.error('Failed to load changelog');
    } finally {
      setChangelogLoading(false);
    }
  }, [fetchCurrentChangelogFromWeb]);

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
                value={accent}
                onChange={(e) => {
                  setAccent(e.target.value);
                  updateSetting('accentColor', e.target.value);
                  document.documentElement.style.setProperty(
                    '--accent-color',
                    e.target.value,
                  );
                }}
                className="w-10 h-10 rounded border border-border shadow-sm cursor-pointer"
                aria-label="Accent color picker"
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => {
                  const value = e.target.value;
                  setAccent(value);
                  if (CSS.supports('color', value)) {
                    updateSetting('accentColor', value);
                    document.documentElement.style.setProperty(
                      '--accent-color',
                      value,
                    );
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
                updateSetting('colorTheme', v as 'light' | 'dark');
                if (v === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
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
                updateSetting('fontFamily', font);
                document.documentElement.style.setProperty(
                  '--app-font-family',
                  getFontFamilyCSS(font),
                );
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
                  updateSetting('autoUpdate', v);
                  if (window.electronAPI?.setAutoCheck) {
                    window.electronAPI.setAutoCheck(v);
                  }
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
                  {updateStatus === 'available' && updateVersion && (
                    <span className="text-primary">
                      v{updateVersion} available
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
      <ChangelogModal
        open={showChangelog}
        changelog={updateChangelog}
        version={updateVersion ?? ''}
        onOpenChange={setShowChangelog}
        onInstall={handleInstallUpdate}
      />
      <UpdateProgressModal
        open={showProgress}
        version={updateVersion ?? ''}
        onOpenChange={handleProgressModalOpenChange}
      />
      <ChangelogModal
        open={showCurrentChangelog}
        changelog={currentChangelog || null}
        loading={changelogLoading}
        version={appVersion ?? ''}
        onOpenChange={setShowCurrentChangelog}
      />
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
                updateSetting('confirmBeforeDelete', v);
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
              onCheckedChange={(v) => updateSetting('notesDefaultOpen', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
