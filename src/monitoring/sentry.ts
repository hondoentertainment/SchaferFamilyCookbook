import * as Sentry from '@sentry/react';

function parseSampleRate(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
    return n;
}

/**
 * Optional error monitoring. Set VITE_SENTRY_DSN in Vercel / .env.production.local.
 *
 * Optional tuning (all 0–1):
 * - VITE_SENTRY_TRACES_SAMPLE_RATE (default 0.05)
 * - VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE (default 0 — set e.g. 0.1 to sample session replay on errors)
 */
export function initSentry(): void {
    if (!import.meta.env.PROD) return;
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || typeof dsn !== 'string') return;

    const release = import.meta.env.VITE_SENTRY_RELEASE?.trim();
    const environment =
        import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE;

    const tracesSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.05);
    const replaysOnErrorSampleRate = parseSampleRate(
        import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
        0
    );

    Sentry.init({
        dsn,
        environment,
        ...(release ? { release } : {}),
        integrations: [
            Sentry.browserTracingIntegration(),
            ...(replaysOnErrorSampleRate > 0
                ? [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })]
                : []),
        ],
        tracesSampleRate,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate,
        beforeSend(event, hint) {
            const err = hint.originalException;
            if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError') {
                return null;
            }
            return event;
        },
    });
}

/** True when production build has a DSN configured (monitoring may still init at runtime). */
export function isSentryConfigured(): boolean {
    return import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN;
}

/** Fire a one-off test event; returns false when Sentry is not active. */
export function sendSentryTestEvent(): boolean {
    if (!isSentryConfigured()) return false;
    Sentry.captureMessage('Schafer Cookbook Sentry connectivity test', 'info');
    return true;
}

export { Sentry };
