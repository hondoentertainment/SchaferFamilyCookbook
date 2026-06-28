import type { GalleryItem, GalleryModerationStatus } from '../types';

/** Matches Twilio webhook and Firebase Storage rule limit */
export const MAX_GALLERY_FILE_BYTES = 25 * 1024 * 1024;

export const MAX_GALLERY_CAPTION_LENGTH = 500;

export type GalleryFileValidation =
    | { ok: true }
    | { ok: false; message: string };

export function isGalleryMediaType(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType.startsWith('video/');
}

export function galleryItemTypeFromFile(file: File): 'image' | 'video' {
    return file.type.startsWith('video/') ? 'video' : 'image';
}

export function validateGalleryFile(file: File): GalleryFileValidation {
    if (!isGalleryMediaType(file.type)) {
        return { ok: false, message: 'Please choose a photo or video file.' };
    }
    if (file.size > MAX_GALLERY_FILE_BYTES) {
        return { ok: false, message: 'File is too large. Please use media under 25 MB.' };
    }
    if (file.size === 0) {
        return { ok: false, message: 'That file appears to be empty.' };
    }
    return { ok: true };
}

export function buildGalleryItem(
    file: File,
    caption: string,
    contributor: string,
    id = `g${Date.now()}`,
    status: GalleryModerationStatus = 'pending'
): GalleryItem {
    return {
        id,
        type: galleryItemTypeFromFile(file),
        url: '',
        caption: caption.trim().slice(0, MAX_GALLERY_CAPTION_LENGTH),
        contributor: contributor.trim(),
        created_at: new Date().toISOString(),
        status,
    };
}
