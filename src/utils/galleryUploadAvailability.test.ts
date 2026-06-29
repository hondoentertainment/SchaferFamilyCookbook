import { describe, it, expect, vi, afterEach } from 'vitest';
import { isGalleryUploadEnabled, shouldShowGalleryUploadUnavailableBanner } from './galleryUploadAvailability';

describe('galleryUploadAvailability', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('isGalleryUploadEnabled is true only when env flag is true', () => {
        vi.stubEnv('VITE_GALLERY_UPLOADS_ENABLED', 'true');
        expect(isGalleryUploadEnabled()).toBe(true);

        vi.stubEnv('VITE_GALLERY_UPLOADS_ENABLED', 'false');
        expect(isGalleryUploadEnabled()).toBe(false);
    });

    it('shouldShowGalleryUploadUnavailableBanner when firebase and uploads disabled', () => {
        vi.stubEnv('VITE_GALLERY_UPLOADS_ENABLED', 'false');
        expect(shouldShowGalleryUploadUnavailableBanner('firebase')).toBe(true);
        expect(shouldShowGalleryUploadUnavailableBanner('local')).toBe(false);
    });

    it('hides banner when uploads are enabled', () => {
        vi.stubEnv('VITE_GALLERY_UPLOADS_ENABLED', 'true');
        expect(shouldShowGalleryUploadUnavailableBanner('firebase')).toBe(false);
    });
});
