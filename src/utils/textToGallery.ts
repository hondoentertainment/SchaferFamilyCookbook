import { STORAGE_KEYS } from '../constants/storage';

/** Twilio MMS number from build-time env (fallback when Firestore config/settings is unset). */
export function getArchivePhoneFromEnv(): string {
    return import.meta.env.VITE_ARCHIVE_PHONE?.trim() || '';
}

/** Resolve the gallery text number: Firestore/localStorage first, then VITE_ARCHIVE_PHONE. */
export function resolveArchivePhone(storedPhone?: string | null): string {
    const fromStore = storedPhone?.trim() || '';
    if (fromStore) return fromStore;

    try {
        const fromLocal = localStorage.getItem(STORAGE_KEYS.archivePhone)?.trim();
        if (fromLocal) return fromLocal;
    } catch {
        /* ignore */
    }

    return getArchivePhoneFromEnv();
}

export function isTextToGalleryConfigured(storedPhone?: string | null): boolean {
    return resolveArchivePhone(storedPhone).length > 0;
}
