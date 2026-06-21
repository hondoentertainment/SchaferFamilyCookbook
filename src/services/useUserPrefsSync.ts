import { useEffect, useRef } from 'react';
import {
    createDebouncedWriter,
    deriveUserId,
    fetchRemotePrefs,
    mergePrefs,
    subscribeToPrefsChanges,
    type UserPrefsPayload,
} from './userPrefsSync';
import { getFavoriteIds } from '../utils/favorites';
import { getAllRatings } from '../utils/ratings';
import { getAllCollections } from '../utils/collections';
import { getMealPlan } from '../utils/mealPlan';
import { STORAGE_KEYS } from '../constants/storage';
import type { RecipeRating } from '../types';
import { CloudArchive } from './db';

/**
 * Read current local prefs in the shape of UserPrefsPayload, scoped to `userName`.
 * Ratings in localStorage are a flat list across all users; we filter to this user.
 */
function readLocalPrefs(userName: string): UserPrefsPayload {
    const favorites = [...getFavoriteIds()];
    const allRatings = getAllRatings();
    const ratings: Record<string, number> = {};
    for (const r of allRatings) {
        if (r.userName === userName) {
            ratings[r.recipeId] = r.rating;
        }
    }
    const collections = getAllCollections();
    const mealPlan = getMealPlan();
    return { favorites, ratings, collections, mealPlan };
}

/**
 * Apply merged remote prefs back into local storage. This writes directly
 * (bypassing setRating/setFavoriteIds's own notifications) so we don't loop.
 */
function applyMergedPrefsToLocal(userName: string, merged: UserPrefsPayload): void {
    // Favorites: union'd set. Write directly to localStorage to skip the notify bus.
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(merged.favorites));

    // Ratings: remote wins per recipeId for THIS user; other users' ratings untouched.
    const existing: RecipeRating[] = (() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ratings);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as RecipeRating[]) : [];
        } catch {
            return [];
        }
    })();
    const others = existing.filter((r) => r.userName !== userName);
    const nowIso = new Date().toISOString();
    const mineMerged: RecipeRating[] = Object.entries(merged.ratings).map(([recipeId, rating]) => ({
        recipeId,
        userName,
        rating,
        timestamp: nowIso,
    }));
    localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify([...others, ...mineMerged]));

    localStorage.setItem(STORAGE_KEYS.collections, JSON.stringify(merged.collections));
    localStorage.setItem(STORAGE_KEYS.mealPlan, JSON.stringify(merged.mealPlan));
}

export interface UseUserPrefsSyncOptions {
    /** Called after remote prefs have been merged into local state, so the
     *  consumer can re-read local state into React (e.g. refresh favorites). */
    onHydrated?: () => void;
    /** Debounce window for remote writes, in ms. Default 750. */
    debounceMs?: number;
}

/**
 * Wire up cloud sync for a user's favorites, ratings, collections, and meal plan.
 *
 *  - On first render (and whenever `userName` changes), hydrate: fetch remote,
 *    merge with local, persist merged back to local storage, and call
 *    `onHydrated` so the caller can rerun its local reads into React state.
     *  - On every local change to preferences, schedule a debounced write.
 *  - Guest / no-firebase / network failure: no-ops; local stays authoritative.
 */
export function useUserPrefsSync(
    userName: string | null | undefined,
    options: UseUserPrefsSyncOptions = {}
): void {
    const { onHydrated, debounceMs = 750 } = options;
    const writerRef = useRef<ReturnType<typeof createDebouncedWriter> | null>(null);
    const onHydratedRef = useRef(onHydrated);
    onHydratedRef.current = onHydrated;

    if (!writerRef.current) {
        writerRef.current = createDebouncedWriter(debounceMs);
    }

    const userId = deriveUserId(userName);

    // Hydrate on identity change.
    useEffect(() => {
        let cancelled = false;
        if (!userId || !userName) return;
        // If cloud isn't active, nothing to hydrate from.
        if (CloudArchive.getProvider() !== 'firebase') return;

        (async () => {
            const remote = await fetchRemotePrefs(userId);
            if (cancelled) return;
            if (!remote) {
                // No remote doc yet — push current local up so future devices see it.
                const local = readLocalPrefs(userName);
                if (
                    local.favorites.length > 0 ||
                    Object.keys(local.ratings).length > 0 ||
                    local.collections.length > 0 ||
                    (local.mealPlan?.length ?? 0) > 0
                ) {
                    writerRef.current?.schedule(userId, local);
                }
                return;
            }
            const local = readLocalPrefs(userName);
            const merged = mergePrefs(local, remote);
            applyMergedPrefsToLocal(userName, merged);
            onHydratedRef.current?.();
            // If merging changed anything vs. remote, push the union back up.
            const remoteFavSet = new Set(remote.favorites);
            const mergedAddedFavs = merged.favorites.some((f) => !remoteFavSet.has(f));
            const mergedAddedRatings = Object.keys(merged.ratings).some(
                (k) => !(k in remote.ratings)
            );
            const remoteColById = new Map(remote.collections.map((c) => [c.id, c]));
            const mergedAddedCollections =
                merged.collections.length > remote.collections.length ||
                merged.collections.some((c) => {
                    const remoteCol = remoteColById.get(c.id);
                    if (!remoteCol) return true;
                    return c.recipeIds.some((id) => !remoteCol.recipeIds.includes(id));
                });
            const remoteMealPlan = remote.mealPlan ?? [];
            const mergedMealPlan = merged.mealPlan ?? [];
            const remoteMealIds = new Set(remoteMealPlan.map((entry) => entry.id));
            const mergedAddedMealPlan =
                mergedMealPlan.length > remoteMealPlan.length ||
                mergedMealPlan.some((entry) => !remoteMealIds.has(entry.id));
            if (mergedAddedFavs || mergedAddedRatings || mergedAddedCollections || mergedAddedMealPlan) {
                writerRef.current?.schedule(userId, merged);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, userName]);

    // Push local changes up.
    useEffect(() => {
        if (!userId || !userName) return;
        if (CloudArchive.getProvider() !== 'firebase') return;
        const unsub = subscribeToPrefsChanges(() => {
            const local = readLocalPrefs(userName);
            writerRef.current?.schedule(userId, local);
        });
        return () => {
            unsub();
        };
    }, [userId, userName]);
}
