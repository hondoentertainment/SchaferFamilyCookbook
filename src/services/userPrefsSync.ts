import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { CloudArchive } from './db';
import { Sentry } from '../monitoring/sentry';
import type { RecipeCollection, RecipeNote } from '../types';
import type { MealPlanEntry } from '../utils/mealPlan';
import type { GroceryItem } from '../utils/groceryList';

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
 * Cloud-sync layer for user-specific preferences (favorites + ratings + collections + meal plan + grocery list).
 *
 * Stored per-user at `userPrefs/{userId}` as:
 *   {
 *     favorites: string[],
 *     ratings: Record<recipeId, rating>,
 *     collections: RecipeCollection[],
 *     mealPlan: MealPlanEntry[],
 *     groceryList: GroceryItem[],
 *     notes: RecipeNote[],
 *     displayName: string,
 *     updatedAt: Timestamp
 *   }
 *
 * `ratings`, `notes`, and `displayName` are world-readable and feed the
 * family-wide aggregate (see services/familyPrefs.ts) so everyone sees
 * everyone's ratings and recipe notes.
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
    groceryList?: GroceryItem[];
    notes?: RecipeNote[];
    /** Tombstones: ids of deleted notes, so removals survive cross-device merges. */
    deletedNoteIds?: string[];
    displayName?: string;
}

/** Keep the tombstone list bounded; notes are rare, so this is years of headroom. */
const MAX_DELETED_NOTE_IDS = 500;

export function parseDeletedNoteIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** Union tombstones from both sides, newest kept when the cap is exceeded. */
export function mergeDeletedNoteIds(local: string[], remote: string[]): string[] {
    return [...new Set([...remote, ...local])].slice(-MAX_DELETED_NOTE_IDS);
}

export function parseNoteEntry(raw: unknown): RecipeNote | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) return null;
    if (typeof o.recipeId !== 'string' || !o.recipeId) return null;
    if (typeof o.userName !== 'string') return null;
    if (typeof o.text !== 'string' || !o.text.trim()) return null;
    if (typeof o.timestamp !== 'string') return null;
    return {
        id: o.id,
        recipeId: o.recipeId,
        userName: o.userName,
        text: o.text,
        timestamp: o.timestamp,
    };
}

export function parseNotes(raw: unknown): RecipeNote[] {
    if (!Array.isArray(raw)) return [];
    const out: RecipeNote[] = [];
    for (const item of raw) {
        const note = parseNoteEntry(item);
        if (note) out.push(note);
    }
    return out;
}

/**
 * Union notes by id; on id collision prefer the newer timestamp. Notes whose
 * id appears in `deletedNoteIds` are excluded, so a deletion on one device is
 * not resurrected by a stale copy from another.
 */
export function mergeNotes(
    local: RecipeNote[],
    remote: RecipeNote[],
    deletedNoteIds: ReadonlySet<string> = new Set()
): RecipeNote[] {
    const byId = new Map<string, RecipeNote>();
    for (const note of [...local, ...remote]) {
        if (deletedNoteIds.has(note.id)) continue;
        const existing = byId.get(note.id);
        if (!existing) {
            byId.set(note.id, note);
            continue;
        }
        const noteTime = Date.parse(note.timestamp) || 0;
        const existingTime = Date.parse(existing.timestamp) || 0;
        if (noteTime > existingTime) byId.set(note.id, note);
    }
    return [...byId.values()].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
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

function groceryDedupKey(recipeId: string | undefined, text: string): string {
    return `${recipeId ?? ''}::${text.trim().toLowerCase()}`;
}

function parseGroceryItem(raw: unknown): GroceryItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) return null;
    if (typeof o.text !== 'string' || !o.text.trim()) return null;
    if (typeof o.checked !== 'boolean') return null;
    if (typeof o.addedAt !== 'number' || !Number.isFinite(o.addedAt)) return null;
    return {
        id: o.id,
        text: o.text.trim(),
        recipeId: typeof o.recipeId === 'string' ? o.recipeId : undefined,
        recipeTitle: typeof o.recipeTitle === 'string' ? o.recipeTitle : undefined,
        checked: o.checked,
        addedAt: o.addedAt,
    };
}

function parseGroceryList(raw: unknown): GroceryItem[] {
    if (!Array.isArray(raw)) return [];
    const out: GroceryItem[] = [];
    for (const item of raw) {
        const parsed = parseGroceryItem(item);
        if (parsed) out.push(parsed);
    }
    return out;
}

/**
 * Merge grocery items by stable id, then de-dupe recipeId + text pairs.
 * Checked state wins if either device marked an item done.
 */
export function mergeGroceryList(local: GroceryItem[], remote: GroceryItem[]): GroceryItem[] {
    const byId = new Map<string, GroceryItem>();
    for (const item of [...local, ...remote]) {
        const existing = byId.get(item.id);
        if (!existing) {
            byId.set(item.id, item);
            continue;
        }
        const newer = item.addedAt >= existing.addedAt ? item : existing;
        const older = item.addedAt >= existing.addedAt ? existing : item;
        byId.set(item.id, {
            ...newer,
            checked: existing.checked || item.checked,
            recipeTitle: newer.recipeTitle ?? older.recipeTitle,
        });
    }

    const byKey = new Map<string, GroceryItem>();
    for (const item of byId.values()) {
        const key = groceryDedupKey(item.recipeId, item.text);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, item);
            continue;
        }
        const checked = existing.checked || item.checked;
        const picked = existing.checked && !item.checked
            ? existing
            : item.checked && !existing.checked
              ? item
              : item.addedAt >= existing.addedAt
                ? item
                : existing;
        byKey.set(key, { ...picked, checked });
    }

    return [...byKey.values()].sort((a, b) => b.addedAt - a.addedAt);
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
        const groceryList = parseGroceryList(data?.groceryList);
        const notes = parseNotes(data?.notes);
        const deletedNoteIds = parseDeletedNoteIds(data?.deletedNoteIds);
        const displayName =
            typeof data?.displayName === 'string' && data.displayName.trim()
                ? data.displayName.trim()
                : undefined;
        return { favorites, ratings, collections, mealPlan, groceryList, notes, deletedNoteIds, displayName };
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
    const ref = doc(db, 'userPrefs', userId);
    // Firestore rejects the ENTIRE write when any nested field is an explicit
    // `undefined` (e.g. a manual grocery item's recipeId, or a collection
    // without a description). JSON round-trip drops those keys.
    const stripUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    const legacyPayload: Record<string, unknown> = {
        favorites: [...new Set(payload.favorites)],
        ratings: stripUndefined(payload.ratings),
        collections: stripUndefined(payload.collections),
        mealPlan: stripUndefined(payload.mealPlan ?? []),
        groceryList: stripUndefined(payload.groceryList ?? []),
        updatedAt: serverTimestamp(),
    };
    const docPayload: Record<string, unknown> = {
        ...legacyPayload,
        notes: stripUndefined(payload.notes ?? []),
        deletedNoteIds: payload.deletedNoteIds ?? [],
    };
    if (payload.displayName?.trim()) docPayload.displayName = payload.displayName.trim();
    try {
        await setDoc(ref, docPayload, { merge: true });
        return true;
    } catch (err) {
        // Deployed rules may predate the notes/displayName fields, in which
        // case the whole write is rejected. Retry with the legacy shape so
        // favorites/ratings/collections sync keeps working until the new
        // rules are deployed.
        const code = (err as { code?: string } | null)?.code;
        if (code === 'permission-denied') {
            try {
                await setDoc(ref, legacyPayload, { merge: true });
                logSyncError('writeRemotePrefs.legacyFallback', err);
                return true;
            } catch (legacyErr) {
                logSyncError('writeRemotePrefs', legacyErr);
                return false;
            }
        }
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
 *   - groceryList: union by item id, de-duped by recipeId + text; checked wins.
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
    const deletedNoteIds = mergeDeletedNoteIds(
        local.deletedNoteIds ?? [],
        remote.deletedNoteIds ?? []
    );
    return {
        favorites: [...favSet],
        ratings,
        collections: mergeCollections(local.collections, remote.collections),
        mealPlan: mergeMealPlan(local.mealPlan ?? [], remote.mealPlan ?? []),
        groceryList: mergeGroceryList(local.groceryList ?? [], remote.groceryList ?? []),
        notes: mergeNotes(local.notes ?? [], remote.notes ?? [], new Set(deletedNoteIds)),
        deletedNoteIds,
        displayName: local.displayName ?? remote.displayName,
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
