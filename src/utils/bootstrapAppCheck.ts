import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { CloudArchive } from '../services/db';

/**
 * Optional Firebase App Check (reCAPTCHA v3). Set VITE_FIREBASE_APP_CHECK_SITE_KEY in production.
 * Register the site key in Firebase Console → App Check for the web app.
 */
export function bootstrapAppCheck(): void {
    if (!import.meta.env.PROD) return;
    const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
    if (!siteKey) return;
    if (CloudArchive.getProvider() !== 'firebase') return;

    const fb = CloudArchive.getFirebase();
    if (!fb) return;

    try {
        initializeAppCheck(fb.app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true,
        });
    } catch (err) {
        console.warn('[App Check] initialization failed:', err);
    }
}
