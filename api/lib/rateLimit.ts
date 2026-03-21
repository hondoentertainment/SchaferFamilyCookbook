/**
 * In-memory sliding-window rate limiter for serverless handlers.
 * Note: Each warm instance has its own map; under heavy load use Redis/Upstash for shared limits.
 */

type TimestampBucket = number[];

const buckets = new Map<string, TimestampBucket>();

export function slidingWindowAllow(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    let times = buckets.get(key);
    if (!times) {
        times = [];
        buckets.set(key, times);
    }
    const cutoff = now - windowMs;
    while (times.length > 0 && times[0]! < cutoff) {
        times.shift();
    }
    if (times.length >= maxRequests) {
        return false;
    }
    times.push(now);
    return true;
}

export function getClientIp(req: {
    headers?: Record<string, string | string[] | undefined> | { [key: string]: string | string[] | undefined };
    socket?: { remoteAddress?: string | null };
}): string {
    const headers = req.headers ?? {};
    const xf = headers['x-forwarded-for'];
    if (typeof xf === 'string') {
        const first = xf.split(',')[0]?.trim();
        if (first) return first;
    }
    if (Array.isArray(xf) && xf[0]) {
        return String(xf[0]).split(',')[0]?.trim() || 'unknown';
    }
    const ra = req.socket?.remoteAddress;
    return ra && ra.length > 0 ? ra : 'unknown';
}

/** Default: 45 Gemini API calls per IP per rolling minute. */
export const GEMINI_RATE_LIMIT = { max: 45, windowMs: 60_000 };
