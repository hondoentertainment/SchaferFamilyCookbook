/**
 * Lightweight performance measurement utilities.
 * Reports to Sentry when available, otherwise logs to console in dev.
 */

/** Measure and report a named operation */
export function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    if (import.meta.env.DEV) {
      console.debug(`[perf] ${name}: ${duration.toFixed(1)}ms`);
    }
  });
}

/** Report Web Vitals to console in dev */
export function reportWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Use PerformanceObserver for Core Web Vitals
  if ('PerformanceObserver' in window) {
    // LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (import.meta.env.DEV) {
        console.debug(`[perf] LCP: ${lastEntry.startTime.toFixed(0)}ms`);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      if (import.meta.env.DEV) {
        console.debug(`[perf] CLS: ${clsValue.toFixed(4)}`);
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  }
}
