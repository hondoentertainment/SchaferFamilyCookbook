import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import * as Sentry from '@sentry/react';

/**
 * Wire Core Web Vitals to Sentry. Each metric is recorded two ways:
 *
 *  - `Sentry.setMeasurement` — attaches to the active transaction when one
 *    exists (pageload/navigation).
 *  - A breadcrumb — INP and the final CLS report typically fire after the
 *    pageload transaction has finished, where setMeasurement would silently
 *    drop them; the breadcrumb rides along with whatever event is sent next.
 *
 * CLS is a unitless fraction (typically < 1), so it is reported at 3-decimal
 * precision rather than rounded to an integer. Time-based metrics are
 * rounded to whole milliseconds.
 */
export function metricValueForReport(metric: Pick<Metric, 'name' | 'value'>): number {
    return metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value);
}

function send(metric: Metric): void {
    const value = metricValueForReport(metric);
    const unit = metric.name === 'CLS' ? '' : 'millisecond';
    if (import.meta.env.DEV) {
        console.log(`[web-vitals] ${metric.name}=${value} rating=${metric.rating} id=${metric.id}`);
    }
    try {
        Sentry.setMeasurement(metric.name, value, unit);
        Sentry.addBreadcrumb({
            category: 'web-vitals',
            message: `${metric.name}=${value}`,
            level: 'info',
            data: { value, rating: metric.rating, navigationType: metric.navigationType },
        });
    } catch {
        // Sentry may be uninitialized in dev — reporting is best-effort.
    }
}

export function initWebVitals(): void {
    onCLS(send);
    onINP(send);
    onLCP(send);
    onFCP(send);
    onTTFB(send);
}
