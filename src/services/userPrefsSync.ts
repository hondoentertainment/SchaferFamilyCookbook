import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { CloudArchive } from './db';
import { Sentry } from '../monitoring/sentry';

// --- Local-change notification bus ---------------------------------------
// Components mutate local state through utils/favorites.ts and utils/ratings.ts.
// Those utils don't know about the sync layer, so they dispatch a lightweight
// notification and this module's subscribers (typically `useUserPrefsSync`)
// schedule a debounced remote write.

type PrefsChangeListener = () => void;
const listeners = new Set<PrefsChangeListener>();

export function subscribeToPrefsChanges(listener: PrefsChangeListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notifyPrefsChanged(): void {
    for (const l of listeners) {
        try {
            l();
        } catch (err) {
            logSyncError('listener', err);
        }
    }
}

/**
 * Cloud-sync layer for user-specific preferences (favorites + ratings).
 *
 * Stored per-user at `userPrefs/{userId}` as:
 *   { favorites: string[], ratings: Record<recipeId, rating>, updatedAt: Timestamp }
 *
 * Local utilities in `src/utils/favorites.ts` and `src/utils/ratings.ts` remain
 * the source of truth for component state; this module opportunistically
 * mirrors them to Firestore when cloud is configured.
 *
 * All operations degrade gracefully: if Firebase is not configured or the
 * network fails, local state keeps working and callers never throw.
 */

export interface UserPrefsPayload {
    favorites: string[];
    ratings: Record<string, number>;
}

/**
 * Derive a stable, Firestore-safe document id from a user's display name.
 * Mirrors App.tsx's identity model: the name is the identity. We slugify
 * (lowercase, hyphenated, ASCII-only) so that "Grandma Joan" and
 * " grandma   joan " share the same remote document.
 */
export function deriveUserId(displayName: string | null | undefined): string | null {
    if (!displayName) return null;
    const slug = displayName
        .toLowerCase()
        .trim()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || null;
}

function getDb(): Firestore | null {
    try {
        const fb = CloudArchive.getFirebase();
        if (!fb) return null;
        if (CloudArchive.getProvider() !== 'firebase') return null;
        return fb.db;
    } catch {
        return null;
    }
}

function logSyncError(scope: string, err: unknown): void {
    // Don't spam console in tests; still capture through Sentry when available.
    try {
        Sentry.captureException(err, { tags: { scope } });
    } catch {
        // Sentry not initialized — fine.
    }
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[userPrefsSync:${scope}]`, err);
    }
}

/**
 * Fetch a user's cloud preferences. Returns null when cloud is unavailable,
 * the doc is missing, or the read fails.
 */
export async function fetchRemotePrefs(userId: string): Promise<UserPrefsPayload | null> {
    const db = getDb();
    if (!db || !userId) return null;
    try {
        const ref = doc(db, 'userPrefs', userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const data = snap.data() as Partial<UserPrefsPayload> | undefined;
        const favorites = Array.isArray(data?.favorites)
            ? (data!.favorites as unknown[]).filter((x): x is string => typeof x === 'string')
            : [];
        const ratingsIn = data?.ratings && typeof data.ratings === 'object' ? data.ratings : {};
        const ratings: Record<string, number> = {};
        for (const [k, v] of Object.entries(ratingsIn)) {
            if (typeof v === 'number' && Number.isFinite(v)) {
                ratings[k] = Math.max(1, Math.min(5, v));
            }
        }
        return { favorites, ratings };
    } catch (err) {
        logSyncError('fetchRemotePrefs', err);
        return null;
    }
}

/**
 * Overwrite the remote prefs doc for a user. Fire-and-forget; errors are
 * logged but never thrown.
 */
export async function writeRemotePrefs(
    userId: string,
    payload: UserPrefsPayload
): Promise<boolean> {
    const db = getDb();
    if (!db || !userId) return false;
    try {
        const ref = doc(db, 'userPrefs', userId);
        await setDoc(
            ref,
            {
                favorites: [...new Set(payload.favorites)],
                ratings: payload.ratings,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
        return true;
    } catch (err) {
        logSyncError('writeRemotePrefs', err);
        return false;
    }
}

/**
 * Merge strategy on login:
 *   - favorites: union of local + remote (neither side loses a fave)
 *   - ratings: remote wins per recipeId (treated as authoritative, since
 *     the user explicitly set them on some device — last writer wins is
 *     implicit via updatedAt, but the cheap merge is "prefer remote value
 *     when present; otherwise keep local").
 */
export function mergePrefs(
    local: UserPrefsPayload,
    remote: UserPrefsPayload
): UserPrefsPayload {
    const favSet = new Set<string>([...local.favorites, ...remote.favorites]);
    const ratings: Record<string, number> = { ...local.ratings };
    for (const [recipeId, rating] of Object.entries(remote.ratings)) {
        ratings[recipeId] = rating;
    }
    return {
        favorites: [...favSet],
        ratings,
    };
}

/**
 * Debounced writer. Callers invoke `scheduleRemoteWrite(userId, payload)`
 * on every local change; the actual Firestore write fires after `delayMs`
 * of quiet. Replaces any pending write for the same user.
 */
export function createDebouncedWriter(delayMs = 750) {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const latest = new Map<string, UserPrefsPayload>();

    const flush = (userId: string): Promise<boolean> => {
        const payload = latest.get(userId);
        timers.delete(userId);
        latest.delete(userId);
        if (!payload) return Promise.resolve(false);
        return writeRemotePrefs(userId, payload);
    };

    return {
        schedule(userId: string, payload: UserPrefsPayload): void {
            if (!userId) return;
            latest.set(userId, payload);
            const existing = timers.get(userId);
            if (existing) clearTimeout(existing);
            timers.set(
                userId,
                setTimeout(() => {
                    void flush(userId);
                }, delayMs)
            );
        },
        /** Immediately write any pending payload for a user (e.g. on logout). */
        flush,
        /** Cancel any pending write without saving. */
        cancel(userId: string): void {
            const existing = timers.get(userId);
            if (existing) clearTimeout(existing);
            timers.delete(userId);
            latest.delete(userId);
        },
    };
}
