import { useState, useEffect, useCallback } from 'react';
import { CloudArchive } from '../services/db';
import {
    getPendingUploads,
    processPendingUploads,
} from '../services/offlineUploadQueue';

interface UseOfflineUploadQueueOptions {
    /** Called after a successful batch upload so the caller can refresh gallery state. */
    onUploadsProcessed?: () => Promise<void>;
    /** Called with toast-style messages during online processing. */
    onToast?: (message: string, type: 'info' | 'success' | 'error') => void;
}

interface UseOfflineUploadQueueResult {
    pendingUploadCount: number;
    refreshPendingCount: () => Promise<void>;
}

/**
 * Manages the offline upload queue state:
 * - Tracks the count of pending uploads
 * - Refreshes the count when `tab` or `gallery` dependency changes
 * - Processes queued uploads automatically when the device comes back online
 */
export function useOfflineUploadQueue(
    tab: string,
    galleryLength: number,
    { onUploadsProcessed, onToast }: UseOfflineUploadQueueOptions = {}
): UseOfflineUploadQueueResult {
    const [pendingUploadCount, setPendingUploadCount] = useState(0);

    const refreshPendingCount = useCallback(async () => {
        const pending = await getPendingUploads();
        setPendingUploadCount(pending.length);
    }, []);

    // Check on mount and whenever the gallery tab is opened.
    useEffect(() => {
        void refreshPendingCount();
    }, [tab, galleryLength, refreshPendingCount]);

    // Process queued uploads automatically when the device comes back online.
    useEffect(() => {
        const handleOnline = async () => {
            const pending = await getPendingUploads();
            if (pending.length === 0) return;

            onToast?.(`Back online — uploading ${pending.length} queued photo(s)…`, 'info');

            const { processed, failed } = await processPendingUploads(async (file, caption, contributor) => {
                const isVideo = file.type.startsWith('video/');
                const url = await CloudArchive.uploadFile(file, 'gallery');
                await CloudArchive.upsertGalleryItem({
                    id: 'g' + Date.now(),
                    type: isVideo ? 'video' : 'image',
                    url: url || '',
                    caption,
                    contributor,
                });
            });

            await refreshPendingCount();
            await onUploadsProcessed?.();

            if (processed > 0) {
                onToast?.(`${processed} photo(s) uploaded successfully.`, 'success');
            }
            if (failed > 0) {
                onToast?.(`${failed} photo(s) failed to upload. They remain in the queue.`, 'error');
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [refreshPendingCount, onUploadsProcessed, onToast]);

    return { pendingUploadCount, refreshPendingCount };
}
