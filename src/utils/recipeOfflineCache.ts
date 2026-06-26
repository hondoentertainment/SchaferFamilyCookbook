import type { Recipe } from '../types';

const DB_NAME = 'schafer-recipe-offline';
const STORE_NAME = 'recipes';
const DB_VERSION = 1;
const MAX_ENTRIES = 150;

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
    } catch (err) {
        console.warn('[recipeOfflineCache] cacheRecipeOffline failed:', err);
    }
}

export async function cacheRecipesOffline(recipes: Recipe[]): Promise<void> {
    if (!isIdbAvailable() || recipes.length === 0) return;
    try {
        const slice = recipes.slice(0, MAX_ENTRIES);
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const recipe of slice) {
                store.put(recipe);
            }
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('[recipeOfflineCache] cacheRecipesOffline failed:', err);
    }
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
