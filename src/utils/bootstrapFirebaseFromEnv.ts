import { STORAGE_KEYS } from '../constants/storage';

export interface FirebaseClientConfig {
    apiKey: string;
    projectId: string;
    authDomain?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
}

/** Build config from Vite env when both apiKey and projectId are present. */
export function readFirebaseConfigFromEnv(): FirebaseClientConfig | null {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
    if (!apiKey || !projectId) return null;

    const authDomain =
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`;
    const storageBucket =
        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
        `${projectId}.firebasestorage.app`;
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
    const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();

    return {
        apiKey,
        projectId,
        authDomain,
        storageBucket,
        ...(messagingSenderId ? { messagingSenderId } : {}),
        ...(appId ? { appId } : {}),
    };
}

/**
 * When production builds include `VITE_FIREBASE_API_KEY` + `VITE_FIREBASE_PROJECT_ID`,
 * seed localStorage so family cloud sync works without manual Admin wiring.
 * Skips when the user already chose a provider or has saved config.
 */
export function bootstrapFirebaseFromEnv(): void {
    if (typeof localStorage === 'undefined') return;

    const existingProvider = localStorage.getItem(STORAGE_KEYS.activeProvider);
    const existingConfig = localStorage.getItem(STORAGE_KEYS.firebaseConfig);
    if (existingProvider && existingConfig) return;

    const config = readFirebaseConfigFromEnv();
    if (!config) return;

    localStorage.setItem(STORAGE_KEYS.firebaseConfig, JSON.stringify(config));
    localStorage.setItem(STORAGE_KEYS.activeProvider, 'firebase');
}
