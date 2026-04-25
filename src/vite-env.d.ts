/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SENTRY_DSN?: string;
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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
