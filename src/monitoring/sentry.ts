import * as Sentry from '@sentry/react';

/**
 * Optional error monitoring. Set VITE_SENTRY_DSN in Vercel / .env.production.local.
 */
export function initSentry(): void {
    if (!import.meta.env.PROD) return;
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || typeof dsn !== 'string') return;

    const release = import.meta.env.VITE_SENTRY_RELEASE?.trim();
    const environment =
        import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE;

    Sentry.init({
        dsn,
        environment,
        ...(release ? { release } : {}),
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.05,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    });
}

export { Sentry };
