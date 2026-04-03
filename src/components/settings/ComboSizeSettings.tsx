import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useSettings } from '@/context/SettingsContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseComboNotation } from '@/lib/parser';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';

const SAMPLE_COMBO = '5L > 2M > 236H > j.M';

const SCALE_LABELS: Record<number, string> = {
  0.75: 'Small',
  1: 'Default',
  1.25: 'Large',
  1.5: 'Extra Large',
};

export function ComboSizeSettings() {
  const settings = useSettings();
  const scale = settings.comboScale ?? 1;

  const handleScaleChange = async (value: number[]) => {
    await indexedDbStorage.settings.update({ comboScale: value[0] });
  };

  const handleReset = async () => {
    await indexedDbStorage.settings.update({ comboScale: 1 });
    toast.success('Combo size reset to default');
  };

  const sampleTokens = parseComboNotation(SAMPLE_COMBO);
  const scaleLabel = SCALE_LABELS[scale] || `${Math.round(scale * 100)}%`;

  return (
    <div className="space-y-6">
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
              onClick={handleReset}
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
              onValueChange={handleScaleChange}
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
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <ComboDisplay tokens={sampleTokens} mode="colored-text" />
              </div>
            </div>
            <div className="border border-border rounded-md p-3 mt-2">
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <ComboDisplay tokens={sampleTokens} mode="visual-icons" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
