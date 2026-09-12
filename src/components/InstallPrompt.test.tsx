import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';
import { renderWithProviders, setupLocalStorage } from '../test/utils';
import { STORAGE_KEYS } from '../constants/storage';

describe('InstallPrompt', () => {
    const originalMatchMedia = window.matchMedia;
    const originalUserAgent = navigator.userAgent;

    beforeEach(() => {
        setupLocalStorage();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query.includes('standalone') ? false : false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
        vi.useRealTimers();
    });

    it('shows the iOS Share → Home Screen hint after onboarding, above the tab bar', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        });
        localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');

        const { findByTestId, queryByTestId } = renderWithProviders(<InstallPrompt />);
        const banner = await findByTestId('install-prompt');
        expect(banner).toHaveTextContent(/Share/i);
        expect(banner).toHaveTextContent(/Add to Home Screen/i);
        expect(banner.className).toMatch(/--app-bottom-nav-clearance/);
        expect(queryByTestId('install-prompt-install')).not.toBeInTheDocument();

        fireEvent.click(await findByTestId('install-prompt-dismiss'));
        await waitFor(() => {
            expect(queryByTestId('install-prompt')).not.toBeInTheDocument();
        });
        expect(localStorage.getItem(STORAGE_KEYS.installDismissed)).toBe('true');
    });

    it('does not nag after dismiss or when already installed', () => {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        });
        localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');
        localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');

        const dismissed = renderWithProviders(<InstallPrompt />);
        expect(dismissed.queryByTestId('install-prompt')).not.toBeInTheDocument();
        dismissed.unmount();

        localStorage.removeItem(STORAGE_KEYS.installDismissed);
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches: true,
                media: '(display-mode: standalone)',
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
            })),
        });
        const standalone = renderWithProviders(<InstallPrompt />);
        expect(standalone.queryByTestId('install-prompt')).not.toBeInTheDocument();
    });
});
