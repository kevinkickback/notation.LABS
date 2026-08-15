import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCoverEditor } from '@/hooks/useCoverEditor';

describe('useCoverEditor', () => {
  it('initializes and serializes only non-default values', () => {
    const { result } = renderHook(useCoverEditor);

    act(() => {
      result.current.initialize({
        image: 'data:image/png;base64,test',
        zoom: 140,
        panX: 35,
        fit: 'free',
      });
    });

    expect(result.current.serialize()).toEqual({
      image: 'data:image/png;base64,test',
      zoom: 140,
      panX: 35,
      panY: undefined,
      fit: 'free',
    });
  });

  it('resets transforms when applying a new image', () => {
    const { result } = renderHook(useCoverEditor);

    act(() => {
      result.current.initialize({ zoom: 160, panX: 20, panY: 70, fit: 'free' });
      result.current.applyImage('next-image');
    });

    expect(result.current.serialize()).toEqual({
      image: 'next-image',
      zoom: undefined,
      panX: undefined,
      panY: undefined,
      fit: undefined,
    });
  });
});