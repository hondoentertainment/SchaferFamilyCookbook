/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_SUPER_ADMINS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
