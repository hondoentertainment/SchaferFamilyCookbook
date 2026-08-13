import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers: Record<string, (m: unknown) => void> = {};

vi.mock('web-vitals', () => ({
    onCLS: vi.fn((cb: (m: unknown) => void) => {
        handlers.CLS = cb;
    }),
    onINP: vi.fn((cb: (m: unknown) => void) => {
        handlers.INP = cb;
    }),
    onLCP: vi.fn((cb: (m: unknown) => void) => {
        handlers.LCP = cb;
    }),
    onFCP: vi.fn((cb: (m: unknown) => void) => {
        handlers.FCP = cb;
    }),
    onTTFB: vi.fn((cb: (m: unknown) => void) => {
        handlers.TTFB = cb;
    }),
}));

vi.mock('@sentry/react', () => ({
    setMeasurement: vi.fn(),
    addBreadcrumb: vi.fn(),
    init: vi.fn(),
    captureException: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({})),
}));

import { initWebVitals, metricValueForReport } from './webVitals';
import { setMeasurement, addBreadcrumb } from '@sentry/react';

const makeMetric = (name: string, value: number) => ({
    name,
    value,
    rating: 'good',
    id: 'test-id',
    navigationType: 'navigate',
});

describe('metricValueForReport', () => {
    it('preserves fractional CLS at 3-decimal precision', () => {
        expect(metricValueForReport({ name: 'CLS', value: 0.1234 } as never)).toBe(0.123);
        expect(metricValueForReport({ name: 'CLS', value: 0.25 } as never)).toBe(0.25);
    });

    it('does not collapse typical CLS scores to zero', () => {
        expect(metricValueForReport({ name: 'CLS', value: 0.15 } as never)).toBeGreaterThan(0);
    });

    it('rounds time-based metrics to whole milliseconds', () => {
        expect(metricValueForReport({ name: 'LCP', value: 2500.7 } as never)).toBe(2501);
        expect(metricValueForReport({ name: 'TTFB', value: 99.2 } as never)).toBe(99);
    });
});

describe('initWebVitals', () => {
    beforeEach(() => {
        vi.mocked(setMeasurement).mockClear();
        vi.mocked(addBreadcrumb).mockClear();
    });

    it('registers all five web-vitals handlers', () => {
        initWebVitals();
        expect(Object.keys(handlers).sort()).toEqual(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
    });

    it('reports LCP as a millisecond measurement and breadcrumb', () => {
        initWebVitals();
        handlers.LCP(makeMetric('LCP', 1234.6));
        expect(setMeasurement).toHaveBeenCalledWith('LCP', 1235, 'millisecond');
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'web-vitals', message: 'LCP=1235' }),
        );
    });

    it('reports CLS unitless with fractional precision', () => {
        initWebVitals();
        handlers.CLS(makeMetric('CLS', 0.182));
        expect(setMeasurement).toHaveBeenCalledWith('CLS', 0.182, '');
    });

    it('swallows Sentry errors so vitals reporting never breaks the app', () => {
        vi.mocked(setMeasurement).mockImplementation(() => {
            throw new Error('sentry not initialized');
        });
        initWebVitals();
        expect(() => handlers.FCP(makeMetric('FCP', 300))).not.toThrow();
    });
});
