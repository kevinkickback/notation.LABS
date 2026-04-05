import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { useId } from 'react';
import { toast } from 'sonner';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { ButtonIcon } from '@/components/combo/icons/ButtonIcon';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/context/SettingsContext';
import { parseComboNotation } from '@/lib/parser';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { DisplayMode, IconStyle, UserSettings } from '@/lib/types';

const SAMPLE_COMBO = '5L > 2M > 236H';

const SCALE_LABELS: Record<number, string> = {
  0.75: 'Small',
  1: 'Default',
  1.25: 'Large',
  1.5: 'Extra Large',
};

export function NotationSettings() {
  const settings = useSettings();
  const displayModeBaseId = useId();
  const iconStyleBaseId = useId();
  const coloredTextId = `${displayModeBaseId}-colored-text`;
  const visualIconsId = `${displayModeBaseId}-visual-icons`;
  const roundStyleId = `${iconStyleBaseId}-round`;
  const squareStyleId = `${iconStyleBaseId}-square`;
  const hexagonStyleId = `${iconStyleBaseId}-hexagon`;

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    await indexedDbStorage.settings.update({ [key]: value });
  };
  const sampleTokens = parseComboNotation(SAMPLE_COMBO);
  const scale = settings.comboScale ?? 1;
  const scaleLabel = SCALE_LABELS[scale] || `${Math.round(scale * 100)}%`;

  return (
    <div className="space-y-6 min-w-0">
      {/* Display Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Display Mode</CardTitle>
          <CardDescription>
            Choose how combo notation is rendered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.displayMode}
            onValueChange={(v) =>
              updateSetting('displayMode', v as DisplayMode)
            }
            className="flex gap-4"
          >
            <label
              htmlFor={coloredTextId}
              className="flex-1 flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="colored-text" id={coloredTextId} />
              <div>
                <div className="font-medium">Colored Text</div>
                <p className="text-sm text-muted-foreground">
                  Color-coded notation text
                </p>
              </div>
            </label>
            <label
              htmlFor={visualIconsId}
              className="flex-1 flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="visual-icons" id={visualIconsId} />
              <div>
                <div className="font-medium">Visual Icons</div>
                <p className="text-sm text-muted-foreground">
                  SVG icons for inputs
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Icon Style */}
      <Card>
        <CardHeader>
          <CardTitle>Icon Style</CardTitle>
          <CardDescription>
            Shape used for button icons in visual mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.iconStyle ?? 'hexagon'}
            onValueChange={(v) => updateSetting('iconStyle', v as IconStyle)}
            className="flex gap-4"
          >
            <label
              htmlFor={roundStyleId}
              className="flex-1 min-w-0 flex flex-col items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="round" id={roundStyleId} />
              <div className="flex gap-1.5">
                <ButtonIcon
                  button="L"
                  size={28}
                  color="oklch(0.75 0.15 150)"
                  iconStyle="round"
                />
                <ButtonIcon
                  button="M"
                  size={28}
                  color="oklch(0.75 0.15 60)"
                  iconStyle="round"
                />
                <ButtonIcon
                  button="H"
                  size={28}
                  color="oklch(0.65 0.2 25)"
                  iconStyle="round"
                />
              </div>
              <span className="text-sm font-medium">Round</span>
            </label>
            <label
              htmlFor={squareStyleId}
              className="flex-1 min-w-0 flex flex-col items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="square" id={squareStyleId} />
              <div className="flex gap-1.5">
                <ButtonIcon
                  button="L"
                  size={28}
                  color="oklch(0.75 0.15 150)"
                  iconStyle="square"
                />
                <ButtonIcon
                  button="M"
                  size={28}
                  color="oklch(0.75 0.15 60)"
                  iconStyle="square"
                />
                <ButtonIcon
                  button="H"
                  size={28}
                  color="oklch(0.65 0.2 25)"
                  iconStyle="square"
                />
              </div>
              <span className="text-sm font-medium">Square</span>
            </label>
            <label
              htmlFor={hexagonStyleId}
              className="flex-1 min-w-0 flex flex-col items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="hexagon" id={hexagonStyleId} />
              <div className="flex gap-1.5">
                <ButtonIcon
                  button="L"
                  size={28}
                  color="oklch(0.75 0.15 150)"
                  iconStyle="hexagon"
                />
                <ButtonIcon
                  button="M"
                  size={28}
                  color="oklch(0.75 0.15 60)"
                  iconStyle="hexagon"
                />
                <ButtonIcon
                  button="H"
                  size={28}
                  color="oklch(0.65 0.2 25)"
                  iconStyle="hexagon"
                />
              </div>
              <span className="text-sm font-medium">Hexagon</span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Combo Scale */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Combo Card Size</CardTitle>
              <CardDescription>
                Adjust the size of text and icons on combo cards
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateSetting('comboScale', 1);
                toast.success('Combo size reset to default');
              }}
              className="gap-1.5"
            >
              <ArrowClockwiseIcon className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Scale</Label>
              <span className="text-sm text-muted-foreground">
                {scaleLabel}
              </span>
            </div>
            <Slider
              value={[scale]}
              onValueChange={(value) => updateSetting('comboScale', value[0])}
              min={0.75}
              max={1.5}
              step={0.25}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Small</span>
              <span>Default</span>
              <span>Large</span>
              <span>XL</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="border border-border rounded-md p-3"
              style={{ fontSize: `${scale}rem` }}
            >
              <ComboDisplay tokens={sampleTokens} mode="colored-text" />
            </div>
            <div
              className="border border-border rounded-md p-3 mt-2"
              style={{ fontSize: `${scale}rem` }}
            >
              <ComboDisplay tokens={sampleTokens} mode="visual-icons" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
