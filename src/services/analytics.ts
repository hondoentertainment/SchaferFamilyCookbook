import { CloudArchive } from './db';

/**
 * Lightweight analytics service.
 *
 * - Development: logs events to console.debug (no external service required).
 * - Production: persists events to the Firestore `analytics_events` collection.
 *
 * A stable `sessionId` is generated once per page load and stored in
 * sessionStorage so events from the same visit can be grouped together.
 */

function getSessionId(): string {
    const KEY = 'schafer_analytics_session';
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
    return id;
}

export function trackEvent(event: string, data?: Record<string, unknown>): void {
    if (!import.meta.env.PROD) {
        console.debug('[analytics]', event, data ?? {});
        return;
    }

    const fb = CloudArchive.getFirebase();
    if (!fb) return;

    // Fire-and-forget — analytics must never block the UI or throw to callers.
    const payload = {
        event,
        data: data ?? null,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
    };

    import('firebase/firestore')
        .then(({ collection, addDoc }) => addDoc(collection(fb.db, 'analytics_events'), payload))
        .catch(() => {
            // Swallow silently — analytics failures are non-critical.
        });
}
