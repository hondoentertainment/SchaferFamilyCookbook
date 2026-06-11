import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import * as Sentry from '@sentry/react';

/**
 * Wire Core Web Vitals to Sentry as measurements. Each metric is also logged
 * to the console in dev so engineers can spot regressions while iterating.
 *
 * Metrics captured:
 *   - LCP (Largest Contentful Paint) — load performance.
 *   - INP (Interaction to Next Paint) — interactivity.
 *   - CLS (Cumulative Layout Shift) — visual stability.
 *   - FCP, TTFB — diagnostic supplements.
 */
function send(metric: Metric): void {
    const value = Math.round(metric.value);
    if (import.meta.env.DEV) {
        console.log(`[web-vitals] ${metric.name}=${value} rating=${metric.rating} id=${metric.id}`);
    }
    try {
        Sentry.setMeasurement(metric.name, value, metric.name === 'CLS' ? '' : 'millisecond');
    } catch {
        // Sentry may be uninitialized in dev — measurement is best-effort.
    }
}

export function initWebVitals(): void {
    onCLS(send);
    onINP(send);
    onLCP(send);
    onFCP(send);
    onTTFB(send);
}
