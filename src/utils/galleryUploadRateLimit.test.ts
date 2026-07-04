import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkGalleryUploadRateLimit,
    clearGalleryUploadRateLimit,
    GALLERY_UPLOAD_LIMIT,
    recordGalleryUpload,
} from './galleryUploadRateLimit';

/** In-memory localStorage — global test setup uses vi.fn() mocks that do not persist. */
function installMemoryLocalStorage(): void {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
            memory.set(key, value);
        },
        removeItem: (key: string) => {
            memory.delete(key);
        },
        clear: () => {
            memory.clear();
        },
        get length() {
            return memory.size;
        },
        key: (index: number) => [...memory.keys()][index] ?? null,
    });
}

describe('galleryUploadRateLimit', () => {
    beforeEach(() => {
        installMemoryLocalStorage();
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
            expect(checkGalleryUploadRateLimit('Alice').allowed).toBe(true);
            recordGalleryUpload('Alice');
        }
        const result = checkGalleryUploadRateLimit('Alice');
        expect(result.allowed).toBe(false);
        if (result.allowed === false) {
            expect(result.retryAfterMinutes).toBeGreaterThan(0);
        }
    });
});
