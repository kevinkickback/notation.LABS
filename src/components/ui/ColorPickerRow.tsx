import { useState, useEffect } from 'react';
import { TrashIcon } from '@phosphor-icons/react';

interface ColorPickerRowProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
}

export function ColorPickerRow({
  label,
  value,
  onChange,
  onRemove,
}: ColorPickerRowProps) {
  const [editHex, setEditHex] = useState(value);

  useEffect(() => {
    setEditHex(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-8 shrink-0 truncate">{label}</span>
      <label className="relative w-10 h-7 rounded border border-border cursor-pointer overflow-hidden shrink-0">
        <div className="absolute inset-0" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <input
        type="text"
        value={editHex}
        onChange={(e) => setEditHex(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          let val = e.target.value.trim();
          if (!val.startsWith('#')) val = `#${val}`;
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            onChange(val);
          } else {
            setEditHex(value);
          }
        }}
        className="text-xs font-mono w-[4.5rem] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none focus:border-primary"
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          title={`Remove ${label}`}
        >
          <TrashIcon className="w-3.5 h-3.5" weight="bold" />
        </button>
      )}
    </div>
  );
}
