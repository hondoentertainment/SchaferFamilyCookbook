const STORAGE_KEY = 'schafer_gallery_upload_timestamps';

/** Max uploads per contributor per rolling hour (abuse guardrail for open Firebase rules). */
export const GALLERY_UPLOAD_LIMIT = 20;

const WINDOW_MS = 60 * 60 * 1000;

function storageKey(contributor: string): string {
    return contributor.trim().toLowerCase().slice(0, 80) || 'anonymous';
}

function readTimestamps(contributor: string): number[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const map = JSON.parse(raw) as Record<string, number[]>;
        const list = map[storageKey(contributor)];
        return Array.isArray(list) ? list.filter((n) => typeof n === 'number') : [];
    } catch {
        return [];
    }
}

function writeTimestamps(contributor: string, timestamps: number[]): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map = raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
        map[storageKey(contributor)] = timestamps;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* quota / private mode — skip persistence */
    }
}

export type GalleryRateLimitResult =
    | { allowed: true }
    | { allowed: false; retryAfterMinutes: number };

/** Returns whether another upload is allowed within the rolling window. */
export function checkGalleryUploadRateLimit(contributor: string): GalleryRateLimitResult {
    const now = Date.now();
    const recent = readTimestamps(contributor).filter((t) => now - t < WINDOW_MS);
    if (recent.length < GALLERY_UPLOAD_LIMIT) return { allowed: true };
    const oldest = Math.min(...recent);
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return {
        allowed: false,
        retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / 60_000)),
    };
}

/** Record a successful upload for rate-limit accounting. */
export function recordGalleryUpload(contributor: string): void {
    const now = Date.now();
    const recent = readTimestamps(contributor).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    writeTimestamps(contributor, recent);
}

/** Test helper — clears stored timestamps for a contributor. */
export function clearGalleryUploadRateLimit(contributor: string): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const map = JSON.parse(raw) as Record<string, number[]>;
        delete map[storageKey(contributor)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}
