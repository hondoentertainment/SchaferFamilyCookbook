import * as Sentry from '@sentry/react';

/**
 * Optional error monitoring with performance tracking.
 * Set VITE_SENTRY_DSN in Vercel / .env.production.local.
 */
export function initSentry(): void {
    if (!import.meta.env.PROD) return;
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || typeof dsn !== 'string') return;

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.browserProfilingIntegration(),
        ],
        // Performance: sample 20% of transactions in production
        tracesSampleRate: 0.2,
        // Error tracking stays at 100%
        // Propagate traces to our API routes
        tracePropagationTargets: [/\/api\//],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    });
}

export { Sentry };
