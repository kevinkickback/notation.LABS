import { useEffect, useRef, useState } from 'react';
import {
  getCoverImageSizePercent,
  getDraggedFocalPoint,
} from '@/lib/coverImage';
import type { CoverImageFit } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CoverImageProps {
  src: string;
  frameAspect: number;
  fit?: CoverImageFit;
  zoom?: number;
  focalX?: number;
  focalY?: number;
  interactive?: boolean;
  className?: string;
  onFocalPointChange?: (x: number, y: number) => void;
}

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  focalX: number;
  focalY: number;
  travelX: number;
  travelY: number;
}

export function CoverImage({
  src,
  frameAspect,
  fit = 'fill',
  zoom = 100,
  focalX = 50,
  focalY = 50,
  interactive = false,
  className,
  onFocalPointChange,
}: CoverImageProps) {
  const [imageAspect, setImageAspect] = useState<number>();
  const dragState = useRef<DragState | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();

    setImageAspect(undefined);
    image.onload = () => {
      if (active && image.naturalHeight > 0) {
        setImageAspect(image.naturalWidth / image.naturalHeight);
      }
    };
    image.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  const sizePercent = imageAspect
    ? getCoverImageSizePercent(frameAspect, imageAspect, fit, zoom)
    : undefined;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !interactive ||
      !onFocalPointChange ||
      !imageAspect ||
      sizePercent === undefined ||
      event.button !== 0
    ) {
      return;
    }

    const frameWidth = event.currentTarget.clientWidth;
    const frameHeight = event.currentTarget.clientHeight;
    const imageWidth = frameWidth * (sizePercent / 100);
    const imageHeight = imageWidth / imageAspect;

    dragState.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      focalX,
      focalY,
      travelX: frameWidth - imageWidth,
      travelY: frameHeight - imageHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId || !onFocalPointChange) {
      return;
    }

    onFocalPointChange(
      getDraggedFocalPoint(
        drag.focalX,
        event.clientX - drag.clientX,
        drag.travelX,
      ),
      getDraggedFocalPoint(
        drag.focalY,
        event.clientY - drag.clientY,
        drag.travelY,
      ),
    );
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={cn(
        'bg-black bg-no-repeat',
        interactive &&
          'cursor-grab touch-none select-none active:cursor-grabbing',
        className,
      )}
      aria-hidden="true"
      style={{
        backgroundImage: `url(${src})`,
        backgroundPosition: `${focalX}% ${focalY}%`,
        backgroundSize: sizePercent
          ? `${sizePercent}% auto`
          : fit === 'fill'
            ? 'cover'
            : 'contain',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    />
  );
}
