import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { CoverImageFit } from '@/lib/types';

interface CoverImageControlsProps {
  fit: CoverImageFit;
  zoom: number;
  focalX: number;
  focalY: number;
  onFitChange: (fit: CoverImageFit) => void;
  onZoomChange: (zoom: number) => void;
  onFocalXChange: (focalX: number) => void;
  onFocalYChange: (focalY: number) => void;
  onReset: () => void;
}

export function CoverImageControls({
  fit,
  zoom,
  focalX,
  focalY,
  onFitChange,
  onZoomChange,
  onFocalXChange,
  onFocalYChange,
  onReset,
}: CoverImageControlsProps) {
  const fillId = useId();

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id={fillId}
            checked={fit === 'fill'}
            onCheckedChange={(checked) =>
              onFitChange(checked ? 'fill' : 'free')
            }
          />
          <Label
            htmlFor={fillId}
            className="whitespace-nowrap text-xs font-normal text-muted-foreground"
          >
            Fill frame
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 border border-border bg-accent px-2 text-xs text-accent-foreground shadow-xs transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-between gap-2">
        <AdjustmentSlider
          label="Zoom"
          min={100}
          max={200}
          step={5}
          value={zoom}
          displayValue={`${zoom}%`}
          onChange={onZoomChange}
        />
        <AdjustmentSlider
          label="Pan X"
          min={0}
          max={100}
          step={1}
          value={focalX}
          displayValue={`${(focalX - 50) * 2}%`}
          onChange={onFocalXChange}
        />
        <AdjustmentSlider
          label="Pan Y"
          min={0}
          max={100}
          step={1}
          value={focalY}
          displayValue={`${(focalY - 50) * 2}%`}
          onChange={onFocalYChange}
        />
      </div>
    </div>
  );
}

interface AdjustmentSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
}

function AdjustmentSlider({
  label,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
}: AdjustmentSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([nextValue]) => onChange(nextValue)}
        className="flex-1"
        aria-label={label}
      />
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {displayValue}
      </span>
    </div>
  );
}
