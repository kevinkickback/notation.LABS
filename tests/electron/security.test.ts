import { describe, expect, it } from 'vitest';
import {
  isPromptableExternalUrl,
  isSafeExternalUrl,
} from '../../electron/security';

describe('isSafeExternalUrl', () => {
  it('allows known https hosts', () => {
    expect(isSafeExternalUrl('https://github.com/kevinkickback/notation.LABS'))
      .toBe(true);
    expect(isSafeExternalUrl('https://KevinKickback.com')).toBe(true);
    expect(isSafeExternalUrl('https://www.reddit.com/r/Fighters')).toBe(true);
    expect(isSafeExternalUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      true,
    );
    expect(isSafeExternalUrl('https://youtu.be/abc123')).toBe(true);
  });

  it('blocks non-https and unknown hosts', () => {
    expect(isSafeExternalUrl('http://github.com')).toBe(false);
    expect(isSafeExternalUrl('https://example.com')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks credential-bearing URLs and malformed input', () => {
    expect(isSafeExternalUrl('https://user:pass@github.com/path')).toBe(false);
    expect(isSafeExternalUrl('not-a-url')).toBe(false);
  });

  it('marks unknown https links as promptable', () => {
    expect(isPromptableExternalUrl('https://example.com')).toBe(true);
    expect(isPromptableExternalUrl('https://github.com')).toBe(false);
    expect(isPromptableExternalUrl('http://example.com')).toBe(false);
    expect(isPromptableExternalUrl('https://user:pass@example.com')).toBe(
      false,
    );
  });
});
