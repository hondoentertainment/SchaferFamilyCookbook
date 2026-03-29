import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RetryError } from './RetryError';
import { renderWithProviders } from '../test/utils';

describe('RetryError', () => {
    it('renders error message', () => {
        renderWithProviders(
            <RetryError message="Something broke" onRetry={vi.fn()} />
        );

        expect(screen.getByText('Something broke')).toBeInTheDocument();
    });

    it('calls onRetry when button clicked', () => {
        const onRetry = vi.fn();
        renderWithProviders(
            <RetryError message="Failed to load" onRetry={onRetry} />
        );

        fireEvent.click(screen.getByRole('button', { name: /retry/i }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('has role="alert" for accessibility', () => {
        renderWithProviders(
            <RetryError message="Network error" onRetry={vi.fn()} />
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders retry button', () => {
        renderWithProviders(
            <RetryError message="Error occurred" onRetry={vi.fn()} />
        );

        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = renderWithProviders(
            <RetryError message="Error" onRetry={vi.fn()} className="custom-class" />
        );

        expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
});
