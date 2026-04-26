import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';
import { renderWithProviders } from '../test/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const setOnlineStatus = (online: boolean) => {
    Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        writable: true,
        value: online,
    });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('OfflineBanner', () => {
    afterEach(() => {
        // Restore online status between tests
        setOnlineStatus(true);
    });

    // -----------------------------------------------------------------------
    // Nothing rendered when online
    // -----------------------------------------------------------------------
    it('renders nothing when navigator.onLine is true', () => {
        setOnlineStatus(true);
        const { container } = renderWithProviders(<OfflineBanner />);
        expect(container.firstChild).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Banner rendered when offline
    // -----------------------------------------------------------------------
    it('renders the offline banner text when navigator.onLine is false', () => {
        setOnlineStatus(false);
        renderWithProviders(<OfflineBanner />);
        expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
        expect(screen.getByText(/some features may not work/i)).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Accessibility attributes
    // -----------------------------------------------------------------------
    it('banner has role="status" and aria-live="polite"', () => {
        setOnlineStatus(false);
        renderWithProviders(<OfflineBanner />);
        const banner = screen.getByRole('status');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    // -----------------------------------------------------------------------
    // Hides when online event fires
    // -----------------------------------------------------------------------
    it('hides the banner when the "online" event fires', () => {
        setOnlineStatus(false);
        renderWithProviders(<OfflineBanner />);
        expect(screen.getByRole('status')).toBeInTheDocument();

        act(() => {
            fireEvent(window, new Event('online'));
        });

        expect(screen.queryByRole('status')).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Shows when offline event fires (component starts online)
    // -----------------------------------------------------------------------
    it('shows the banner when the "offline" event fires', () => {
        setOnlineStatus(true);
        renderWithProviders(<OfflineBanner />);
        expect(screen.queryByRole('status')).toBeNull();

        act(() => {
            fireEvent(window, new Event('offline'));
        });

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // Event listeners are cleaned up on unmount
    // -----------------------------------------------------------------------
    it('removes event listeners when the component is unmounted', () => {
        setOnlineStatus(true);
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderWithProviders(<OfflineBanner />);

        // Verify listeners were registered
        expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        unmount();

        // Verify they were removed
        expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
