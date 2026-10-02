import {
  ImageSquareIcon,
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import type { CoverImageFit } from '@/lib/types';
import { CoverImage } from './CoverImage';
import { CoverImageControls } from './CoverImageControls';

interface EntityArtworkEditorProps {
  label: string;
  image: string;
  orientation: 'portrait' | 'landscape';
  fit: CoverImageFit;
  zoom: number;
  focalX: number;
  focalY: number;
  onUpload: () => void;
  onSearch: () => void;
  onRemove: () => void;
  onFitChange: (fit: CoverImageFit) => void;
  onZoomChange: (zoom: number) => void;
  onFocalXChange: (value: number) => void;
  onFocalYChange: (value: number) => void;
  onReset: () => void;
}

export function EntityArtworkEditor({
  label,
  image,
  orientation,
  fit,
  zoom,
  focalX,
  focalY,
  onUpload,
  onSearch,
  onRemove,
  onFitChange,
  onZoomChange,
  onFocalXChange,
  onFocalYChange,
  onReset,
}: EntityArtworkEditorProps) {
  const labelId = useId();

  return (
    <section className="entity-artwork" aria-labelledby={labelId}>
      <p id={labelId} className="entity-section-label">
        {label} <span className="entity-optional">Optional</span>
      </p>
      <div className="entity-artwork-workspace">
        <div className="entity-artwork-stage">
          <div className="entity-artwork-frame" data-orientation={orientation}>
            {image ? (
              <>
                <CoverImage
                  src={image}
                  frameAspect={orientation === 'portrait' ? 3 / 4 : 4 / 3}
                  fit={fit}
                  zoom={zoom}
                  focalX={focalX}
                  focalY={focalY}
                  interactive
                  className="absolute inset-0"
                  onFocalPointChange={(x, y) => {
                    onFocalXChange(Math.round(x));
                    onFocalYChange(Math.round(y));
                  }}
                />
                <button
                  type="button"
                  className="entity-artwork-remove"
                  aria-label="Remove image"
                  onClick={onRemove}
                >
                  <XIcon size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="entity-artwork-empty"
                aria-label={`Upload ${label.toLowerCase()}`}
                onClick={onUpload}
              >
                <ImageSquareIcon size={36} weight="light" />
                <span>Choose an image</span>
              </button>
            )}
          </div>
          <p className="entity-artwork-hint">
            {image ? 'Drag image to reposition' : 'Image files up to 2 MB'}
          </p>
        </div>
        <div className="entity-artwork-tools">
          <div className="entity-artwork-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUpload}
            >
              <UploadSimpleIcon size={16} />
              {image ? 'Replace Image' : 'Upload Image'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onSearch}>
              <MagnifyingGlassIcon size={16} />
              Search Online
            </Button>
          </div>
          {image && (
            <CoverImageControls
              fit={fit}
              zoom={zoom}
              focalX={focalX}
              focalY={focalY}
              onFitChange={onFitChange}
              onZoomChange={onZoomChange}
              onFocalXChange={onFocalXChange}
              onFocalYChange={onFocalYChange}
              onReset={onReset}
            />
          )}
        </div>
      </div>
    </section>
  );
}
