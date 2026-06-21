import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { CloudArchive } from './db';
import { Sentry } from '../monitoring/sentry';
import type { RecipeCollection } from '../types';
import type { MealPlanEntry } from '../utils/mealPlan';

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
 * Cloud-sync layer for user-specific preferences (favorites + ratings + collections + meal plan).
 *
 * Stored per-user at `userPrefs/{userId}` as:
 *   {
 *     favorites: string[],
 *     ratings: Record<recipeId, rating>,
 *     collections: RecipeCollection[],
 *     mealPlan: MealPlanEntry[],
 *     updatedAt: Timestamp
 *   }
 *
 * Local utilities in `src/utils/favorites.ts`, `src/utils/ratings.ts`, and
 * `src/utils/collections.ts` remain the source of truth for component state;
 * this module opportunistically mirrors them to Firestore when cloud is configured.
 *
 * All operations degrade gracefully: if Firebase is not configured or the
 * network fails, local state keeps working and callers never throw.
 */

export interface UserPrefsPayload {
    favorites: string[];
    ratings: Record<string, number>;
    collections: RecipeCollection[];
    mealPlan?: MealPlanEntry[];
}

function parseMealPlanEntry(raw: unknown): MealPlanEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) return null;
    if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
    if (typeof o.recipeId !== 'string' || !o.recipeId) return null;
    if (typeof o.addedAt !== 'number' || !Number.isFinite(o.addedAt)) return null;
    return {
        id: o.id,
        date: o.date,
        recipeId: o.recipeId,
        addedAt: o.addedAt,
    };
}

function parseMealPlan(raw: unknown): MealPlanEntry[] {
    if (!Array.isArray(raw)) return [];
    const out: MealPlanEntry[] = [];
    for (const item of raw) {
        const entry = parseMealPlanEntry(item);
        if (entry) out.push(entry);
    }
    return out;
}

function parseCollectionEntry(raw: unknown): RecipeCollection | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) return null;
    if (typeof o.name !== 'string') return null;
    if (typeof o.createdBy !== 'string') return null;
    if (typeof o.icon !== 'string') return null;
    if (typeof o.timestamp !== 'string') return null;
    const recipeIds = Array.isArray(o.recipeIds)
        ? (o.recipeIds as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
    const description = typeof o.description === 'string' ? o.description : undefined;
    return {
        id: o.id,
        name: o.name,
        description,
        recipeIds: [...new Set(recipeIds)],
        createdBy: o.createdBy,
        icon: o.icon,
        timestamp: o.timestamp,
    };
}

function parseCollections(raw: unknown): RecipeCollection[] {
    if (!Array.isArray(raw)) return [];
    const out: RecipeCollection[] = [];
    for (const item of raw) {
        const c = parseCollectionEntry(item);
        if (c) out.push(c);
    }
    return out;
}

/**
 * Merge two collection lists: union by id; for matching ids union recipeIds;
 * prefer the newer timestamp for name, description, and icon.
 */
export function mergeCollections(
    local: RecipeCollection[],
    remote: RecipeCollection[]
): RecipeCollection[] {
    const byId = new Map<string, RecipeCollection>();

    const mergeTwo = (a: RecipeCollection, b: RecipeCollection): RecipeCollection => {
        const recipeIdSet = new Set([...a.recipeIds, ...b.recipeIds]);
        const aTime = Date.parse(a.timestamp) || 0;
        const bTime = Date.parse(b.timestamp) || 0;
        const newer = bTime >= aTime ? b : a;
        const older = bTime >= aTime ? a : b;
        return {
            id: a.id,
            name: newer.name,
            description: newer.description ?? older.description,
            recipeIds: [...recipeIdSet],
            createdBy: newer.createdBy || older.createdBy,
            icon: newer.icon,
            timestamp: newer.timestamp,
        };
    };

    for (const c of [...local, ...remote]) {
        const existing = byId.get(c.id);
        if (!existing) {
            byId.set(c.id, { ...c, recipeIds: [...new Set(c.recipeIds)] });
        } else {
            byId.set(c.id, mergeTwo(existing, c));
        }
    }
    return [...byId.values()];
}

/**
 * Merge meal-plan entries by stable id, then de-dupe same recipe/day pairs.
 * If two devices add the same recipe to the same day, keep the older entry so
 * the plan order stays closest to the user's first action.
 */
export function mergeMealPlan(
    local: MealPlanEntry[],
    remote: MealPlanEntry[]
): MealPlanEntry[] {
    const byId = new Map<string, MealPlanEntry>();
    for (const entry of [...local, ...remote]) {
        const existing = byId.get(entry.id);
        if (!existing || entry.addedAt < existing.addedAt) {
            byId.set(entry.id, entry);
        }
    }

    const byDayRecipe = new Map<string, MealPlanEntry>();
    for (const entry of byId.values()) {
        const key = `${entry.date}|${entry.recipeId}`;
        const existing = byDayRecipe.get(key);
        if (!existing || entry.addedAt < existing.addedAt) {
            byDayRecipe.set(key, entry);
        }
    }

    return [...byDayRecipe.values()].sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return a.addedAt - b.addedAt;
    });
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
        const collections = parseCollections(data?.collections);
        const mealPlan = parseMealPlan(data?.mealPlan);
        return { favorites, ratings, collections, mealPlan };
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
                collections: payload.collections,
                mealPlan: payload.mealPlan ?? [],
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
 *   - collections: union by id; matching ids union recipeIds; metadata from
 *     the side with the newer timestamp (see mergeCollections).
 *   - mealPlan: union by entry id, de-duped by date + recipeId.
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
        collections: mergeCollections(local.collections, remote.collections),
        mealPlan: mergeMealPlan(local.mealPlan ?? [], remote.mealPlan ?? []),
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
