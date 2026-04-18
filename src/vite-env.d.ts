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
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
