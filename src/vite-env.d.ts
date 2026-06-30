/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SENTRY_DSN?: string;
    /** Release string (typically git SHA); CI/Vercel can inject via `define` */
    readonly VITE_SENTRY_RELEASE?: string;
    /** e.g. production / preview — defaults to MODE when unset */
    readonly VITE_SENTRY_ENVIRONMENT?: string;
    /**
     * Base URL (no trailing slash) for OG share links, e.g.
     * `https://schafer-cookbook.vercel.app`. When set, the share UI copies
     * `${VITE_SHARE_BASE}/share/recipe/<id>` so iMessage/WhatsApp/Slack render
     * a share card. When unset (GitHub Pages), we fall back to the SPA hash
     * route `#recipe/<id>`.
     */
    readonly VITE_SHARE_BASE?: string;
    /**
     * Firebase Cloud Messaging VAPID key (Web Push certificate).
     * Generate it in the Firebase console under:
     *   Project settings → Cloud Messaging → Web Push certificates → Generate key pair
     * Then add to your `.env`:
     *   VITE_FCM_VAPID_KEY=your_key_here
     */
    readonly VITE_FCM_VAPID_KEY?: string;
    readonly VITE_FIREBASE_API_KEY?: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
    readonly VITE_FIREBASE_PROJECT_ID?: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly VITE_FIREBASE_APP_ID?: string;
    /** When `true`, Firestore/Storage use local emulators (CI E2E). */
    readonly VITE_FIREBASE_USE_EMULATOR?: string;
    /** reCAPTCHA v3 site key for Firebase App Check (production only). */
    readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string;
    /** Set to `true` once Firebase Storage is enabled for gallery uploads. */
    readonly VITE_GALLERY_UPLOADS_ENABLED?: string;
    /** Twilio MMS number (E.164) shown on Gallery tab when Firestore config/settings is unset. */
    readonly VITE_ARCHIVE_PHONE?: string;
    /** Must match NOTIFY_SECRET on Vercel for /api/notify from admin UI. */
    readonly VITE_NOTIFY_SECRET?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
