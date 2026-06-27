import type { Recipe } from '../types';

const DB_NAME = 'schafer-recipe-offline';
const STORE_NAME = 'recipes';
const DB_VERSION = 1;

export const OFFLINE_CACHE_UPDATED_EVENT = 'schafer:offline-cache-updated';

function notifyOfflineCacheUpdated(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(OFFLINE_CACHE_UPDATED_EVENT));
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function isIdbAvailable(): boolean {
    try {
        return typeof indexedDB !== 'undefined';
    } catch {
        return false;
    }
}

async function putRecipe(recipe: Recipe): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(recipe);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Persist recipe text for Cook Mode when the in-memory list is unavailable (offline reload).
 */
export async function cacheRecipeOffline(recipe: Recipe): Promise<void> {
    if (!isIdbAvailable()) return;
    try {
        await putRecipe(recipe);
        notifyOfflineCacheUpdated();
    } catch (err) {
        console.warn('[recipeOfflineCache] cacheRecipeOffline failed:', err);
    }
}

export async function cacheRecipesOffline(recipes: Recipe[]): Promise<void> {
    if (!isIdbAvailable() || recipes.length === 0) return;
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const recipe of recipes) {
                store.put(recipe);
            }
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
        notifyOfflineCacheUpdated();
    } catch (err) {
        console.warn('[recipeOfflineCache] cacheRecipesOffline failed:', err);
    }
}

/** All recipe ids currently stored for offline cook mode. */
export async function listOfflineRecipeIds(): Promise<string[]> {
    if (!isIdbAvailable()) return [];
    try {
        const db = await openDb();
        return await new Promise<string[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAllKeys();
            req.onsuccess = () => {
                resolve((req.result as IDBValidKey[]).map(String));
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (err) {
        console.warn('[recipeOfflineCache] listOfflineRecipeIds failed:', err);
        return [];
    }
}

export async function hasOfflineRecipe(id: string): Promise<boolean> {
    const recipe = await getOfflineRecipe(id);
    return recipe !== null;
}

export async function getOfflineRecipe(id: string): Promise<Recipe | null> {
    if (!isIdbAvailable()) return null;
    try {
        const db = await openDb();
        return await new Promise<Recipe | null>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => {
                resolve((req.result as Recipe | undefined) ?? null);
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (err) {
        console.warn('[recipeOfflineCache] getOfflineRecipe failed:', err);
        return null;
    }
}
