/**
 * Build Firebase web client config from VITE_FIREBASE_* env vars or FIREBASE_WEB_CONFIG JSON.
 */
export function firebaseConfigFromEnv() {
    const raw = process.env.FIREBASE_WEB_CONFIG?.trim();
    if (raw) {
        const c = JSON.parse(raw);
        if (!c.apiKey || !c.projectId) {
            throw new Error('FIREBASE_WEB_CONFIG must include apiKey and projectId.');
        }
        return c;
    }

    const apiKey = process.env.VITE_FIREBASE_API_KEY?.trim();
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim();
    if (!apiKey || !projectId) {
        throw new Error(
            'Set FIREBASE_WEB_CONFIG or VITE_FIREBASE_API_KEY + VITE_FIREBASE_PROJECT_ID (e.g. vercel env pull).',
        );
    }

    const authDomain =
        process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`;
    const storageBucket =
        process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.firebasestorage.app`;

    return {
        apiKey,
        projectId,
        authDomain,
        storageBucket,
        ...(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
            ? { messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim() }
            : {}),
        ...(process.env.VITE_FIREBASE_APP_ID?.trim()
            ? { appId: process.env.VITE_FIREBASE_APP_ID.trim() }
            : {}),
    };
}
