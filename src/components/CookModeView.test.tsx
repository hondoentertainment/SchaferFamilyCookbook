import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { CookModeView } from './CookModeView';
import { createMockRecipe, renderWithProviders } from '../test/utils';

/**
 * Fire a synthetic touch sequence on the given element. happy-dom's
 * TouchEvent lacks a `touches` constructor option, so we dispatch the React
 * synthetic events via fireEvent with a payload containing the fields the
 * `useSwipe` hook reads.
 */
function swipe(el: Element, startX: number, startY: number, endX: number, endY: number) {
    fireEvent.touchStart(el, {
        touches: [{ clientX: startX, clientY: startY }],
        targetTouches: [{ clientX: startX, clientY: startY }],
        changedTouches: [{ clientX: startX, clientY: startY }],
    });
    fireEvent.touchEnd(el, {
        touches: [],
        targetTouches: [],
        changedTouches: [{ clientX: endX, clientY: endY }],
    });
}

describe('CookModeView', () => {
    const mockOnClose = vi.fn();
    const defaultProps = {
        recipe: createMockRecipe({
            instructions: ['Preheat oven', 'Mix batter', 'Bake for 30 minutes'],
        }),
        onClose: mockOnClose,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // happy-dom doesn't implement wakeLock or vibrate; ensure harmless stubs.
        (navigator as unknown as { vibrate?: (pattern: number | number[]) => boolean }).vibrate = vi.fn(() => true);
    });

    it('starts on the ingredients step', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
        expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    it('advances to the next step on left swipe of the step body', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);

        const body = screen.getByText('Ingredients').closest('div[class*="overflow-y-auto"]');
        expect(body).toBeTruthy();
        // Swipe left (end X < start X by > threshold) with negligible vertical.
        swipe(body!, 250, 100, 80, 105);

        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
        expect(screen.getByText('Preheat oven')).toBeInTheDocument();
    });

    it('goes back on right swipe after advancing', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);
        const firstBody = screen.getByText('Ingredients').closest('div[class*="overflow-y-auto"]')!;
        swipe(firstBody, 250, 100, 80, 100);

        // Now on step 2. Find the step body and swipe right.
        const stepBody = screen.getByText('Preheat oven').closest('div[class*="touch-pan-y"]')!;
        swipe(stepBody, 80, 100, 250, 100);

        expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
    });

    it('ignores predominantly vertical drags (scroll gesture)', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);
        const body = screen.getByText('Ingredients').closest('div[class*="overflow-y-auto"]')!;
        swipe(body, 150, 50, 180, 400);

        // Still on ingredients.
        expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    it('keyboard ArrowRight advances the step', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });

    it('shows the first-time swipe hint and hides it after a successful swipe', () => {
        renderWithProviders(<CookModeView {...defaultProps} />);
        expect(screen.getByText(/Tip: Swipe left\/right to navigate/i)).toBeInTheDocument();

        const body = screen.getByText('Ingredients').closest('div[class*="overflow-y-auto"]')!;
        swipe(body, 250, 100, 80, 100);

        expect(screen.queryByText(/Tip: Swipe left\/right to navigate/i)).not.toBeInTheDocument();
    });

    it('requests speech synthesis when Listen is pressed on a cooking step', () => {
        const speak = vi.fn();
        const cancel = vi.fn();
        vi.stubGlobal(
            'speechSynthesis',
            Object.assign(Object.create(EventTarget.prototype), {
                speak,
                cancel,
                getVoices: vi.fn(() => []),
                speaking: false,
                pending: false,
                paused: false,
                pause: vi.fn(),
                resume: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        );
        vi.stubGlobal(
            'SpeechSynthesisUtterance',
            vi.fn(function MockUtter(this: { text: string; rate: number }, txt: string) {
                this.text = txt;
                this.rate = 1;
            }),
        );

        try {
            renderWithProviders(<CookModeView {...defaultProps} />);
            const body = screen.getByText('Ingredients').closest('div[class*="overflow-y-auto"]')!;
            swipe(body, 250, 100, 80, 105);

            fireEvent.click(screen.getByTestId('cook-mode-listen'));
            expect(speak).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
