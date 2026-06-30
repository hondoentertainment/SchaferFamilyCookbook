import { normalizeContributorName } from '../constants/taxonomy';
import type { GalleryItem } from '../types';

/**
 * Notify the uploader (when they have push enabled) that their gallery photo was approved.
 * No-op when VITE_NOTIFY_SECRET is unset or FCM is not configured.
 */
export async function notifyGalleryApproved(item: GalleryItem): Promise<void> {
    const secret = import.meta.env.VITE_NOTIFY_SECRET as string | undefined;
    if (!secret?.trim()) return;

    const contributor = normalizeContributorName(item.contributor);
    const caption = item.caption?.trim() || 'Your memory';

    try {
        const resp = await fetch('/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-notify-secret': secret,
            },
            body: JSON.stringify({
                title: 'Your photo is live!',
                body: `"${caption}" is now in the family gallery.`,
                userName: contributor,
            }),
        });
        if (!resp.ok) {
            console.warn('Gallery approve notify failed:', resp.status);
        }
    } catch (err) {
        console.warn('Gallery approve notify error:', err);
    }
}
