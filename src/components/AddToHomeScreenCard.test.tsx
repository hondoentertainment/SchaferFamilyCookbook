import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddToHomeScreenCard } from './AddToHomeScreenCard';

describe('AddToHomeScreenCard', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it('explains Add to Home Screen when the app is not installed', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
        render(<AddToHomeScreenCard />);
        expect(screen.getByTestId('add-to-home-screen-card')).toHaveTextContent(/home screen/i);
    });

    it('hides itself in standalone PWA display', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches: true,
                media: '(display-mode: standalone)',
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
        const { queryByTestId } = render(<AddToHomeScreenCard />);
        expect(queryByTestId('add-to-home-screen-card')).not.toBeInTheDocument();
    });
});
