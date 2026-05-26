import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/react', () => ({
    init: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: 'browserTracing' })),
    replayIntegration: vi.fn(() => ({ name: 'replay' })),
    captureException: vi.fn(),
}));

import * as Sentry from '@sentry/react';
import { initSentry } from './sentry';

const sentryInit = Sentry.init as unknown as ReturnType<typeof vi.fn>;

function stub(env: Record<string, string | boolean>) {
    for (const [key, value] of Object.entries(env)) {
        if (key === 'PROD' || key === 'DEV' || key === 'SSR') {
            // Vitest types these as booleans; coerce so callers can pass true/false.
            (vi.stubEnv as unknown as (n: string, v: boolean) => void)(
                key,
                Boolean(value),
            );
        } else {
            vi.stubEnv(key, String(value));
        }
    }
}

describe('initSentry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Always stub PROD as off; tests opt in.
        vi.stubEnv('PROD', false);
        vi.stubEnv('VITE_SENTRY_DSN', '');
        vi.stubEnv('VITE_SENTRY_ENVIRONMENT', '');
        vi.stubEnv('VITE_SENTRY_RELEASE', '');
        vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '');
        vi.stubEnv('VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE', '');
        vi.stubEnv('MODE', 'test');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is a no-op when not in production', () => {
        // PROD is the default-empty stubbed value above.
        stub({ VITE_SENTRY_DSN: 'https://abc@sentry.io/123' });
        initSentry();
        expect(sentryInit).not.toHaveBeenCalled();
    });

    it('is a no-op when production but no DSN', () => {
        stub({ PROD: true, VITE_SENTRY_DSN: '' });
        initSentry();
        expect(sentryInit).not.toHaveBeenCalled();
    });

    it('initialises Sentry when production with valid DSN', () => {
        stub({
            PROD: true,
            VITE_SENTRY_DSN: 'https://abc@sentry.io/123',
            VITE_SENTRY_ENVIRONMENT: 'production',
            MODE: 'production',
        });
        initSentry();
        expect(sentryInit).toHaveBeenCalledTimes(1);
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        expect(args.dsn).toBe('https://abc@sentry.io/123');
        expect(args.environment).toBe('production');
        expect(args.tracesSampleRate).toBe(0.05);
        expect(args.replaysOnErrorSampleRate).toBe(0);
    });

    it('parses sampling overrides within range', () => {
        stub({
            PROD: true,
            VITE_SENTRY_DSN: 'https://abc@sentry.io/123',
            VITE_SENTRY_TRACES_SAMPLE_RATE: '0.5',
            VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: '0.1',
        });
        initSentry();
        expect(sentryInit).toHaveBeenCalledTimes(1);
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        expect(args.tracesSampleRate).toBe(0.5);
        expect(args.replaysOnErrorSampleRate).toBe(0.1);
    });

    it('falls back to defaults when sampling rates are out of range', () => {
        stub({
            PROD: true,
            VITE_SENTRY_DSN: 'https://abc@sentry.io/123',
            VITE_SENTRY_TRACES_SAMPLE_RATE: 'NaN',
            VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: '5',
        });
        initSentry();
        expect(sentryInit).toHaveBeenCalledTimes(1);
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        expect(args.tracesSampleRate).toBe(0.05);
        expect(args.replaysOnErrorSampleRate).toBe(0);
    });

    it('beforeSend drops AbortError events but keeps real errors', () => {
        stub({ PROD: true, VITE_SENTRY_DSN: 'https://abc@sentry.io/123' });
        initSentry();
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        const beforeSend = args.beforeSend as (event: unknown, hint: unknown) => unknown;
        const aborted = beforeSend({ id: 'evt' }, { originalException: { name: 'AbortError' } });
        expect(aborted).toBeNull();
        const real = beforeSend({ id: 'evt' }, { originalException: new Error('boom') });
        expect(real).toEqual({ id: 'evt' });
    });

    it('only adds the replay integration when replaysOnErrorSampleRate > 0', () => {
        stub({
            PROD: true,
            VITE_SENTRY_DSN: 'https://abc@sentry.io/123',
            VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: '0',
        });
        initSentry();
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        const integrations = args.integrations as Array<{ name: string }>;
        expect(integrations.some((i) => i.name === 'replay')).toBe(false);
        expect(integrations.some((i) => i.name === 'browserTracing')).toBe(true);
    });

    it('adds the replay integration when replaysOnErrorSampleRate > 0', () => {
        stub({
            PROD: true,
            VITE_SENTRY_DSN: 'https://abc@sentry.io/123',
            VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: '0.25',
        });
        initSentry();
        const args = sentryInit.mock.calls[0][0] as Record<string, unknown>;
        const integrations = args.integrations as Array<{ name: string }>;
        expect(integrations.some((i) => i.name === 'replay')).toBe(true);
    });
});
