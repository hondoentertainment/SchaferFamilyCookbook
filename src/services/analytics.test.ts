import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { trackEvent } from './analytics';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

// firebase/firestore is already globally mocked via src/test/setup.ts
// We import it here only to spy on individual mock fns.

describe('analytics service', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
        vi.clearAllMocks();
        // Wipe out sessionStorage between tests so session IDs don't leak across cases.
        sessionStorage.clear();
    });

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function activateFirebase() {
        localStorage.setItem('schafer_active_provider', 'firebase');
        localStorage.setItem(
            'schafer_firebase_config',
            JSON.stringify({ apiKey: 'test', projectId: 'test' })
        );
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
    }

    // -------------------------------------------------------------------------
    // Development mode (import.meta.env.PROD === false, the Vitest default)
    // -------------------------------------------------------------------------

    describe('development mode', () => {
        it('calls console.debug with the event name and empty data object when no data is provided', () => {
            const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            trackEvent('page_view');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('[analytics]', 'page_view', {});
        });

        it('calls console.debug with the event name and provided data', () => {
            const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            trackEvent('recipe_viewed', { id: 'r1', title: 'Pie' });
            expect(spy).toHaveBeenCalledWith('[analytics]', 'recipe_viewed', { id: 'r1', title: 'Pie' });
        });

        it('does NOT call Firestore addDoc in development mode', async () => {
            vi.spyOn(console, 'debug').mockImplementation(() => {});
            trackEvent('some_event');
            // Yield to any pending micro-tasks.
            await Promise.resolve();
            const { addDoc } = await import('firebase/firestore');
            expect(addDoc).not.toHaveBeenCalled();
        });

        it('returns without throwing even when Firebase is not configured', () => {
            vi.spyOn(console, 'debug').mockImplementation(() => {});
            expect(() => trackEvent('test')).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // Production mode — force import.meta.env.PROD to true
    // -------------------------------------------------------------------------

    describe('production mode', () => {
        beforeEach(() => {
            (import.meta.env as Record<string, unknown>).PROD = true;
        });

        afterEach(() => {
            (import.meta.env as Record<string, unknown>).PROD = false;
        });

        it('calls Firestore addDoc with correct payload shape', async () => {
            activateFirebase();
            const { addDoc, collection } = await import('firebase/firestore');

            trackEvent('button_click', { buttonId: 'save' });

            // Let the dynamic import inside trackEvent settle.
            await vi.waitFor(async () => {
                expect(addDoc).toHaveBeenCalled();
            });

            const callArgs = vi.mocked(addDoc).mock.calls[0];
            // First arg is the collection ref (result of collection()), second is the payload.
            expect(collection).toHaveBeenCalledWith(expect.anything(), 'analytics_events');
            const payload = callArgs[1] as Record<string, unknown>;
            expect(payload.event).toBe('button_click');
            expect(payload.data).toEqual({ buttonId: 'save' });
            expect(typeof payload.timestamp).toBe('string');
            expect(typeof payload.sessionId).toBe('string');
        });

        it('stores null for data when no data argument is supplied', async () => {
            activateFirebase();
            const { addDoc } = await import('firebase/firestore');

            trackEvent('page_load');
            await vi.waitFor(async () => {
                expect(addDoc).toHaveBeenCalled();
            });

            const payload = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;
            expect(payload.data).toBeNull();
        });

        it('does NOT call console.debug in production mode', async () => {
            activateFirebase();
            const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            trackEvent('silent_event');
            await Promise.resolve();
            expect(spy).not.toHaveBeenCalled();
        });

        it('does nothing (no throw) when Firebase is not configured', async () => {
            // Force CloudArchive.getFirebase() to return null regardless of localStorage state.
            const spy = vi.spyOn(CloudArchive, 'getFirebase').mockReturnValue(null);
            expect(() => trackEvent('orphan_event')).not.toThrow();
            await Promise.resolve();
            const { addDoc } = await import('firebase/firestore');
            expect(addDoc).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('swallows Firestore errors without throwing to the caller', async () => {
            activateFirebase();
            const { addDoc } = await import('firebase/firestore');
            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore quota exceeded'));

            expect(() => trackEvent('error_event')).not.toThrow();
            // Drain the micro-task queue so the rejection is handled.
            await new Promise(r => setTimeout(r, 0));
        });
    });

    // -------------------------------------------------------------------------
    // Session ID persistence
    // -------------------------------------------------------------------------

    describe('session ID', () => {
        beforeEach(() => {
            (import.meta.env as Record<string, unknown>).PROD = true;
            activateFirebase();
        });

        afterEach(() => {
            (import.meta.env as Record<string, unknown>).PROD = false;
        });

        it('generates a session ID and persists it to sessionStorage on first call', async () => {
            const { addDoc } = await import('firebase/firestore');
            expect(sessionStorage.getItem('schafer_analytics_session')).toBeNull();

            trackEvent('first_event');
            await vi.waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

            expect(sessionStorage.getItem('schafer_analytics_session')).not.toBeNull();
        });

        it('reuses the same session ID across multiple trackEvent calls', async () => {
            const { addDoc } = await import('firebase/firestore');

            trackEvent('event_one');
            await vi.waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
            const id1 = (vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>).sessionId;

            trackEvent('event_two');
            await vi.waitFor(() => expect(addDoc).toHaveBeenCalledTimes(2));
            const id2 = (vi.mocked(addDoc).mock.calls[1][1] as Record<string, unknown>).sessionId;

            expect(id1).toBe(id2);
        });

        it('generates a new session ID when sessionStorage is empty (fresh visit)', async () => {
            const { addDoc } = await import('firebase/firestore');
            sessionStorage.clear();

            trackEvent('fresh_visit');
            await vi.waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

            const payload = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;
            expect(typeof payload.sessionId).toBe('string');
            expect((payload.sessionId as string).length).toBeGreaterThan(0);
        });

        it('reads an existing session ID from sessionStorage rather than creating a new one', async () => {
            const { addDoc } = await import('firebase/firestore');
            sessionStorage.setItem('schafer_analytics_session', 'preset-session-id');

            trackEvent('returning_visit');
            await vi.waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

            const payload = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;
            expect(payload.sessionId).toBe('preset-session-id');
        });
    });
});
