import { describe, expect, it } from 'vitest';
import { createMockGalleryItem } from '../test/utils';
import {
    countPendingForContributor,
    filterGalleryForViewer,
    isGalleryItemPending,
    isGalleryItemPublic,
} from './galleryModeration';

describe('galleryModeration', () => {
    it('treats missing status as public', () => {
        expect(isGalleryItemPublic(createMockGalleryItem())).toBe(true);
        expect(isGalleryItemPending(createMockGalleryItem())).toBe(false);
    });

    it('filters pending items except for the contributor', () => {
        const items = [
            createMockGalleryItem({ id: 'a', contributor: 'Alice', status: 'pending', caption: 'Mine' }),
            createMockGalleryItem({ id: 'b', contributor: 'Bob', caption: 'Public' }),
        ];
        expect(filterGalleryForViewer(items, 'Alice').map((i) => i.id)).toEqual(['a', 'b']);
        expect(filterGalleryForViewer(items, 'Carol').map((i) => i.id)).toEqual(['b']);
    });

    it('counts pending submissions for a contributor', () => {
        const items = [
            createMockGalleryItem({ contributor: 'Alice', status: 'pending' }),
            createMockGalleryItem({ id: 'g2', contributor: 'Alice', status: 'pending' }),
            createMockGalleryItem({ id: 'g3', contributor: 'Bob', status: 'pending' }),
        ];
        expect(countPendingForContributor(items, 'Alice')).toBe(2);
    });
});
