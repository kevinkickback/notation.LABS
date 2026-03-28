
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ErrorFallback } from '@/ErrorFallback';

describe('ErrorFallback', () => {
    beforeAll(() => {
        import.meta.env.DEV = false;
    });

    it('renders error message and reset button', () => {
        const error = new Error('Test error');
        const resetErrorBoundary = vi.fn();
        render(
            <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
        );
        expect(screen.getByText(/application error/i)).not.toBeNull();
        expect(screen.getByText(/test error/i)).not.toBeNull();
        const button = screen.getByRole('button');
        expect(button).not.toBeNull();
        fireEvent.click(button);
        expect(resetErrorBoundary).toHaveBeenCalled();
    });

    it('handles string error', () => {
        const resetErrorBoundary = vi.fn();
        render(
            <ErrorFallback error={'String error'} resetErrorBoundary={resetErrorBoundary} />
        );
        expect(screen.getByText(/string error/i)).not.toBeNull();
    });
});