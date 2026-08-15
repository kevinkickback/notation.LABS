import { useCallback, useState } from 'react';
import type { CoverImageFit } from '@/lib/types';

interface CoverEditorValue {
  image?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  fit?: CoverImageFit;
}

const DEFAULT_ZOOM = 100;
const DEFAULT_PAN = 50;
const DEFAULT_FIT: CoverImageFit = 'fill';

export function useCoverEditor() {
  const [image, setImage] = useState('');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [panX, setPanX] = useState(DEFAULT_PAN);
  const [panY, setPanY] = useState(DEFAULT_PAN);
  const [fit, setFit] = useState<CoverImageFit>(DEFAULT_FIT);

  const resetTransform = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanX(DEFAULT_PAN);
    setPanY(DEFAULT_PAN);
    setFit(DEFAULT_FIT);
  }, []);

  const reset = useCallback(() => {
    setImage('');
    resetTransform();
  }, [resetTransform]);

  const initialize = useCallback((value: CoverEditorValue) => {
    setImage(value.image ?? '');
    setZoom(value.zoom ?? DEFAULT_ZOOM);
    setPanX(value.panX ?? DEFAULT_PAN);
    setPanY(value.panY ?? DEFAULT_PAN);
    setFit(value.fit ?? DEFAULT_FIT);
  }, []);

  const applyImage = useCallback(
    (nextImage: string) => {
      setImage(nextImage);
      resetTransform();
    },
    [resetTransform],
  );

  const serialize = useCallback(
    () => ({
      image: image || undefined,
      zoom: zoom !== DEFAULT_ZOOM ? zoom : undefined,
      panX: panX !== DEFAULT_PAN ? panX : undefined,
      panY: panY !== DEFAULT_PAN ? panY : undefined,
      fit: fit !== DEFAULT_FIT ? fit : undefined,
    }),
    [fit, image, panX, panY, zoom],
  );

  return {
    image,
    setImage,
    zoom,
    setZoom,
    panX,
    setPanX,
    panY,
    setPanY,
    fit,
    setFit,
    initialize,
    reset,
    resetTransform,
    applyImage,
    serialize,
  };
}
