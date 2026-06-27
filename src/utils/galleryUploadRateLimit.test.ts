import { beforeEach, describe, expect, it } from 'vitest';
import {
    checkGalleryUploadRateLimit,
    clearGalleryUploadRateLimit,
    GALLERY_UPLOAD_LIMIT,
    recordGalleryUpload,
} from './galleryUploadRateLimit';

describe('galleryUploadRateLimit', () => {
    beforeEach(() => {
        localStorage.clear();
        clearGalleryUploadRateLimit('Alice');
    });

    it('allows uploads under the limit', () => {
        expect(checkGalleryUploadRateLimit('Alice').allowed).toBe(true);
        for (let i = 0; i < GALLERY_UPLOAD_LIMIT - 1; i++) {
            recordGalleryUpload('Alice');
        }
        expect(checkGalleryUploadRateLimit('Alice').allowed).toBe(true);
    });

    it('blocks when limit exceeded', () => {
        for (let i = 0; i < GALLERY_UPLOAD_LIMIT; i++) {
            recordGalleryUpload('Alice');
        }
        const result = checkGalleryUploadRateLimit('Alice');
        expect(result.allowed).toBe(false);
        if (!result.allowed) {
            expect(result.retryAfterMinutes).toBeGreaterThan(0);
        }
    });
});
