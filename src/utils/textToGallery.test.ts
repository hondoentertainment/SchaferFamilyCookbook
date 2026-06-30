import { afterEach, describe, expect, it, vi } from 'vitest';
import { getArchivePhoneFromEnv, isTextToGalleryConfigured, resolveArchivePhone } from './textToGallery';

describe('textToGallery', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        localStorage.clear();
    });

    it('getArchivePhoneFromEnv reads VITE_ARCHIVE_PHONE', () => {
        vi.stubEnv('VITE_ARCHIVE_PHONE', '+15551234567');
        expect(getArchivePhoneFromEnv()).toBe('+15551234567');
    });

    it('resolveArchivePhone prefers Firestore value over env', () => {
        vi.stubEnv('VITE_ARCHIVE_PHONE', '+15559876543');
        expect(resolveArchivePhone('+15551112222')).toBe('+15551112222');
    });

    it('resolveArchivePhone falls back to localStorage then env', () => {
        vi.stubEnv('VITE_ARCHIVE_PHONE', '+15559876543');
        vi.mocked(localStorage.getItem).mockReturnValueOnce('+15551234567');
        expect(resolveArchivePhone(undefined)).toBe('+15551234567');
        vi.mocked(localStorage.getItem).mockReturnValueOnce(null);
        expect(resolveArchivePhone(undefined)).toBe('+15559876543');
    });

    it('isTextToGalleryConfigured is false when no phone is configured', () => {
        expect(isTextToGalleryConfigured('')).toBe(false);
    });
});
