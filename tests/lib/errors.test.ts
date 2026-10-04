import { describe, expect, it, vi } from 'vitest';
import { reportError, toUserMessage } from '@/lib/errors';
import { z } from 'zod';

describe('errors util', () => {
  it('returns the Error message when present', () => {
    expect(toUserMessage(new Error('boom'))).toBe('boom');
  });

  it('returns fallback message for unknown values', () => {
    expect(toUserMessage('oops')).toBe('An unexpected error occurred');
    expect(toUserMessage(null)).toBe('An unexpected error occurred');
  });
  it('returns plain validation feedback instead of the schema issue array', () => {
    const result = z.string().refine(() => false, 'Backup contains an unsupported or invalid image').safeParse('bad');
    if (result.success) throw new Error('Expected validation to fail');
    expect(toUserMessage(result.error)).toBe('Backup contains an unsupported or invalid image');
    expect(toUserMessage(new z.ZodError([]))).toBe('Some data is invalid or unsupported. Check it and try again.');
  });
  it('explains storage quota failures without exposing browser exception text', () => {
    expect(toUserMessage(new DOMException('quota exceeded', 'QuotaExceededError'))).toMatch(/Local storage is full/);
  });

  it('logs contextual error details', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    reportError('test.context', new Error('fail'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[test.context]',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});
