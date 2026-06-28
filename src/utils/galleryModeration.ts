import type { GalleryItem } from '../types';

export type GalleryModerationStatus = 'pending' | 'approved';

/** Legacy items without `status` are treated as approved. */
export function isGalleryItemPublic(item: GalleryItem): boolean {
    return item.status !== 'pending';
}

export function isGalleryItemPending(item: GalleryItem): boolean {
    return item.status === 'pending';
}

/** Public gallery + viewer's own pending submissions. */
export function filterGalleryForViewer(
    items: GalleryItem[],
    viewerName?: string | null
): GalleryItem[] {
    const viewer = viewerName?.trim().toLowerCase();
    return items.filter((item) => {
        if (isGalleryItemPublic(item)) return true;
        if (!viewer) return false;
        return item.contributor.trim().toLowerCase() === viewer;
    });
}

export function countPendingForContributor(items: GalleryItem[], contributor: string): number {
    const key = contributor.trim().toLowerCase();
    return items.filter(
        (item) => isGalleryItemPending(item) && item.contributor.trim().toLowerCase() === key
    ).length;
}
