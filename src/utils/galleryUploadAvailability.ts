/** When `true`, gallery uploads are enabled in production (Firebase Storage ready). */
export function isGalleryUploadEnabled(): boolean {
    return import.meta.env.VITE_GALLERY_UPLOADS_ENABLED === 'true';
}

/** Show the “uploads unavailable” banner when cloud is connected but Storage is not ready. */
export function shouldShowGalleryUploadUnavailableBanner(provider: string): boolean {
    return provider === 'firebase' && !isGalleryUploadEnabled();
}
