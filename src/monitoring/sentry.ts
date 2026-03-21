import * as Sentry from '@sentry/react';

/**
 * Optional error monitoring. Set VITE_SENTRY_DSN in Vercel / .env.production.local.
 */
export function initSentry(): void {
    if (!import.meta.env.PROD) return;
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || typeof dsn !== 'string') return;

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.05,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    });
}

export { Sentry };
