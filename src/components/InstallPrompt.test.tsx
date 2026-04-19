import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

/**
 * Install a functional in-memory localStorage replacement for each test.
 * (The global test setup stubs localStorage with `vi.fn()` shims that don't
 *  actually store anything — we need real semantics here.)
 */
const installRealLocalStorage = () => {
    const store: Record<string, string> = {};
    const ls: Storage = {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => {
            store[key] = String(value);
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach(k => delete store[k]);
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() {
            return Object.keys(store).length;
        },
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: ls,
        configurable: true,
        writable: true,
    });
    return store;
};

type PromptResult = { outcome: 'accepted' | 'dismissed'; platform?: string };

const makeBeforeInstallPromptEvent = (result: PromptResult = { outcome: 'accepted' }) => {
    // happy-dom doesn't provide BeforeInstallPromptEvent — dispatch a plain
    // Event and attach the `prompt`/`userChoice` fields the component reads.
    const evt = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<PromptResult>;
    };
    evt.prompt = vi.fn(() => Promise.resolve());
    evt.userChoice = Promise.resolve(result);
    return evt;
};

const dispatchBeforeInstallPrompt = (evt: Event) => {
    act(() => {
        window.dispatchEvent(evt);
    });
};

describe('InstallPrompt', () => {
    beforeEach(() => {
        installRealLocalStorage();
        // matchMedia stub: not standalone.
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not render on first visit even if prompt event fires', () => {
        render(<InstallPrompt />);
        expect(localStorage.getItem('pwa.visitCount')).toBe('1');
        const evt = makeBeforeInstallPromptEvent();
        dispatchBeforeInstallPrompt(evt);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders when beforeinstallprompt fires AND visitCount >= 2', () => {
        localStorage.setItem('pwa.visitCount', '1'); // mount increments to 2
        render(<InstallPrompt />);
        expect(localStorage.getItem('pwa.visitCount')).toBe('2');
        const evt = makeBeforeInstallPromptEvent();
        dispatchBeforeInstallPrompt(evt);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /install schafer family cookbook/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /dismiss install prompt/i })).toBeInTheDocument();
    });

    it('suppresses prompt for 30 days after dismiss', () => {
        localStorage.setItem('pwa.visitCount', '5');
        const { unmount } = render(<InstallPrompt />);
        dispatchBeforeInstallPrompt(makeBeforeInstallPromptEvent());
        const notNowBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
        fireEvent.click(notNowBtn);
        expect(screen.queryByRole('dialog')).toBeNull();
        const dismissedAt = localStorage.getItem('pwa.installDismissedAt');
        expect(dismissedAt).not.toBeNull();
        expect(Date.now() - parseInt(dismissedAt!, 10)).toBeLessThan(1000);

        // Re-mount: even with a new prompt event, it should remain suppressed.
        unmount();
        render(<InstallPrompt />);
        dispatchBeforeInstallPrompt(makeBeforeInstallPromptEvent());
        expect(screen.queryByRole('dialog')).toBeNull();

        // Move dismissedAt to >30 days ago — prompt should show again.
        localStorage.setItem('pwa.installDismissedAt', String(Date.now() - 31 * 24 * 60 * 60 * 1000));
        render(<InstallPrompt />);
        dispatchBeforeInstallPrompt(makeBeforeInstallPromptEvent());
        expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
    });

    it('calls the saved prompt on Install click', async () => {
        localStorage.setItem('pwa.visitCount', '3');
        render(<InstallPrompt />);
        const evt = makeBeforeInstallPromptEvent({ outcome: 'accepted' });
        dispatchBeforeInstallPrompt(evt);
        const installBtn = screen.getByRole('button', { name: /install schafer family cookbook/i });
        await act(async () => {
            fireEvent.click(installBtn);
            // let prompt + userChoice microtasks resolve
            await Promise.resolve();
            await Promise.resolve();
        });
        expect((evt as unknown as { prompt: ReturnType<typeof vi.fn> }).prompt).toHaveBeenCalledTimes(1);
    });

    it('hides after Install when user accepts', async () => {
        localStorage.setItem('pwa.visitCount', '3');
        render(<InstallPrompt />);
        const evt = makeBeforeInstallPromptEvent({ outcome: 'accepted' });
        dispatchBeforeInstallPrompt(evt);
        const installBtn = screen.getByRole('button', { name: /install schafer family cookbook/i });
        await act(async () => {
            fireEvent.click(installBtn);
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
