import { describe, expect, it } from 'vitest';
import {
    buildGalleryItem,
    galleryItemTypeFromFile,
    isGalleryMediaType,
    MAX_GALLERY_FILE_BYTES,
    validateGalleryFile,
} from './galleryUpload';

describe('galleryUpload', () => {
    it('accepts image and video mime types', () => {
        expect(isGalleryMediaType('image/jpeg')).toBe(true);
        expect(isGalleryMediaType('video/mp4')).toBe(true);
        expect(isGalleryMediaType('application/pdf')).toBe(false);
    });

    it('rejects oversize files', () => {
        const file = new File([new ArrayBuffer(MAX_GALLERY_FILE_BYTES + 1)], 'big.jpg', {
            type: 'image/jpeg',
        });
        const result = validateGalleryFile(file);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/25 MB/i);
    });

    it('rejects non-media files', () => {
        const file = new File(['x'], 'doc.txt', { type: 'text/plain' });
        expect(validateGalleryFile(file).ok).toBe(false);
    });

    it('builds gallery items with trimmed caption and contributor', () => {
        const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });
        const item = buildGalleryItem(file, '  Summer  ', '  Ada  ', 'g-test');
        expect(item.id).toBe('g-test');
        expect(item.type).toBe('image');
        expect(item.caption).toBe('Summer');
        expect(item.contributor).toBe('Ada');
        expect(item.status).toBe('pending');
        expect(item.created_at).toBeTruthy();
    });

    it('builds approved items for admin uploads', () => {
        const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });
        const item = buildGalleryItem(file, 'Holiday', 'Kyle', 'g-admin', 'approved');
        expect(item.status).toBe('approved');
    });

    it('maps video files to video type', () => {
        const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
        expect(galleryItemTypeFromFile(file)).toBe('video');
    });
});
