import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className utility)', () => {
	it('merges class names', () => {
		expect(cn('foo', 'bar')).toBe('foo bar');
	});

	it('handles conditional classes', () => {
		const isHidden = false;
		expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra');
	});

	it('handles undefined and null', () => {
		expect(cn('base', undefined, null, 'extra')).toBe('base extra');
	});

	it('merges tailwind classes with conflict resolution', () => {
		const result = cn('px-4 py-2', 'px-8');
		expect(result).toBe('py-2 px-8');
	});

	it('returns empty string for no arguments', () => {
		expect(cn()).toBe('');
	});

	it('handles array inputs', () => {
		expect(cn(['foo', 'bar'])).toBe('foo bar');
	});
});
