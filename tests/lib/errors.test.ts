import { describe, expect, it, vi } from 'vitest';
import { reportError, toUserMessage } from '@/lib/errors';

describe('errors util', () => {
  it('returns the Error message when present', () => {
    expect(toUserMessage(new Error('boom'))).toBe('boom');
  });

  it('returns fallback message for unknown values', () => {
    expect(toUserMessage('oops')).toBe('An unexpected error occurred');
    expect(toUserMessage(null)).toBe('An unexpected error occurred');
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
