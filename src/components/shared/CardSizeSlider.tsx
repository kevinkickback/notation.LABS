import { Slider } from '@/components/ui/slider';
import type { CardGridLayout } from '@/lib/cardGrid';

export function CardSizeSlider({
  layout,
  onSizeChange,
}: {
  layout: CardGridLayout;
  onSizeChange: (size: number) => void;
}) {
  return (
    <Slider
      aria-label="Card size"
      aria-valuetext={`${Math.round(layout.width)} pixels, ${layout.columns} per row`}
      min={0}
      max={Math.max(1, layout.sizes.length - 1)}
      step={1}
      value={[layout.index]}
      disabled={layout.sizes.length < 2}
      onValueChange={([index]) => {
        const size = layout.sizes[index];
        if (size !== undefined) onSizeChange(size);
      }}
      className="w-full"
    />
  );
}
