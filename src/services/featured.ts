/**
 * Featured Recipes Service
 *
 * Admins curate a small list of recipe IDs (max 8) stored at Firestore `config/featured`.
 * localStorage is used as an offline fallback.
 *
 * Firestore rules allow any signed-in user to read and admin (custom claim admin:true) to write.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CloudArchive } from './db';

/** Maximum number of recipes allowed in the featured carousel. */
export const FEATURED_LIMIT = 8;

/** LocalStorage cache key (used as offline fallback & when no Firebase is configured). */
export const FEATURED_CACHE_KEY = 'schafer_featured_ids';

/** Firestore collection/doc location */
const CONFIG_COLLECTION = 'config';
const FEATURED_DOC_ID = 'featured';

function readCache(): string[] {
    try {
        const raw = localStorage.getItem(FEATURED_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x): x is string => typeof x === 'string').slice(0, FEATURED_LIMIT);
    } catch {
        return [];
    }
}

function writeCache(ids: string[]): void {
    try {
        localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(ids.slice(0, FEATURED_LIMIT)));
    } catch {
        // localStorage can be unavailable (quota/private mode); ignore.
    }
}

function sanitizeIds(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of input) {
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
        if (out.length >= FEATURED_LIMIT) break;
    }
    return out;
}

/**
 * Reads the featured recipe IDs.
 * Tries Firestore first, falls back to localStorage cache for offline usage.
 */
export async function getFeaturedIds(): Promise<string[]> {
    const fb = CloudArchive.getFirebase();
    if (fb) {
        try {
            const snap = await getDoc(doc(fb.db, CONFIG_COLLECTION, FEATURED_DOC_ID));
            if (snap.exists()) {
                const data = snap.data();
                const ids = sanitizeIds(data?.recipeIds);
                writeCache(ids);
                return ids;
            }
        } catch (err) {
            console.warn('getFeaturedIds: Firestore read failed, using cache', err);
        }
    }
    return readCache();
}

/**
 * Writes featured recipe IDs to Firestore (admin-only via rules).
 * Always caches locally on success.
 * Throws if there's no Firebase connection or the write fails.
 */
export async function setFeaturedIds(ids: string[]): Promise<void> {
    const sanitized = sanitizeIds(ids);
    const fb = CloudArchive.getFirebase();
    if (!fb) {
        // No Firebase: persist locally only.
        writeCache(sanitized);
        return;
    }
    await setDoc(
        doc(fb.db, CONFIG_COLLECTION, FEATURED_DOC_ID),
        { recipeIds: sanitized, updatedAt: serverTimestamp() },
        { merge: true }
    );
    writeCache(sanitized);
}

/**
 * Indicates whether the featured config is (likely) available — i.e., we have
 * Firebase configured or a cached copy from a prior online session.
 */
export function isFeaturedAvailable(): boolean {
    if (CloudArchive.getFirebase()) return true;
    return readCache().length > 0;
}
