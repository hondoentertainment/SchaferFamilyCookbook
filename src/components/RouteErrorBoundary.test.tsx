import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { renderWithProviders } from '../test/utils';

vi.mock('@sentry/react', () => ({
    captureException: vi.fn(),
}));

const ThrowingComponent = () => {
    throw new Error('Test explosion');
};

describe('RouteErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress console.error for expected errors
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('renders children normally when no error', () => {
        renderWithProviders(
            <RouteErrorBoundary>
                <div>Safe content</div>
            </RouteErrorBoundary>
        );

        expect(screen.getByText('Safe content')).toBeInTheDocument();
    });

    it('catches error and shows fallback UI', () => {
        renderWithProviders(
            <RouteErrorBoundary>
                <ThrowingComponent />
            </RouteErrorBoundary>
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.getByText(/this section encountered an error/i)).toBeInTheDocument();
    });

    it('shows label in error message when provided', () => {
        renderWithProviders(
            <RouteErrorBoundary label="Gallery">
                <ThrowingComponent />
            </RouteErrorBoundary>
        );

        expect(screen.getByText(/something went wrong loading gallery/i)).toBeInTheDocument();
    });

    it('shows reload/try again button', () => {
        renderWithProviders(
            <RouteErrorBoundary>
                <ThrowingComponent />
            </RouteErrorBoundary>
        );

        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('reports error to Sentry', async () => {
        const { captureException } = await import('@sentry/react');

        renderWithProviders(
            <RouteErrorBoundary>
                <ThrowingComponent />
            </RouteErrorBoundary>
        );

        expect(captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ extra: expect.any(Object) })
        );
    });
});
