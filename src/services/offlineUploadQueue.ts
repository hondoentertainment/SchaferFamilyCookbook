/**
 * Offline Upload Queue for gallery photos
 *
 * Stores pending uploads in IndexedDB so they can be retried when the device
 * comes back online. Firebase Storage uploads go directly through the SDK (not
 * via fetch), so Workbox BackgroundSync cannot intercept them — this module
 * provides a manual queue instead.
 *
 * DB: 'schafer-offline-uploads'   Store: 'pending-uploads'
 */

const DB_NAME = 'schafer-offline-uploads';
const STORE_NAME = 'pending-uploads';
const DB_VERSION = 1;

export interface PendingUpload {
    id: string;
    file: ArrayBuffer;
    fileName: string;
    mimeType: string;
    caption: string;
    contributor: string;
    queuedAt: string;
}

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

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
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
        return false;
    }
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Queues a file for upload later. Returns the entry id.
 * Falls back gracefully (returns empty string) if IndexedDB is unavailable.
 */
export async function queueUpload(
    file: File,
    caption: string,
    contributor: string
): Promise<string> {
    if (!isIdbAvailable()) return '';

    try {
        const buffer = await file.arrayBuffer();
        const id = 'oq_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const entry: PendingUpload = {
            id,
            file: buffer,
            fileName: file.name,
            mimeType: file.type,
            caption,
            contributor,
            queuedAt: new Date().toISOString(),
        };

        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(entry);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });

        return id;
    } catch (err) {
        console.warn('[offlineUploadQueue] queueUpload failed:', err);
        return '';
    }
}

/**
 * Returns all queued upload entries.
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
    if (!isIdbAvailable()) return [];

    try {
        const db = await openDb();
        return await new Promise<PendingUpload[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result as PendingUpload[]) || []);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (err) {
        console.warn('[offlineUploadQueue] getPendingUploads failed:', err);
        return [];
    }
}

/**
 * Removes an entry from the queue after a successful upload.
 */
export async function removeFromQueue(id: string): Promise<void> {
    if (!isIdbAvailable()) return;

    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (err) {
        console.warn('[offlineUploadQueue] removeFromQueue failed:', err);
    }
}

/**
 * Processes all pending uploads.
 *
 * `uploadFn` receives a reconstructed `File`, the caption, and the
 * contributor name. It should call the real Firebase upload and resolve when
 * done. If it throws, the entry is left in the queue and counted as failed.
 *
 * Returns counts of processed and failed entries.
 */
export async function processPendingUploads(
    uploadFn: (file: File, caption: string, contributor: string) => Promise<string | void>
): Promise<{ processed: number; failed: number; uploadedIds: string[] }> {
    const pending = await getPendingUploads();
    let processed = 0;
    let failed = 0;
    const uploadedIds: string[] = [];

    for (const entry of pending) {
        try {
            const file = new File([entry.file], entry.fileName, { type: entry.mimeType });
            const id = await uploadFn(file, entry.caption, entry.contributor);
            await removeFromQueue(entry.id);
            processed++;
            if (typeof id === 'string' && id) uploadedIds.push(id);
        } catch (err) {
            console.warn(`[offlineUploadQueue] failed to process entry ${entry.id}:`, err);
            failed++;
        }
    }

    return { processed, failed, uploadedIds };
}
