import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { CloudArchive } from './db';

/**
 * Lightweight anonymous-auth helper for securing family-wide writes (e.g. the
 * trivia leaderboard). Every browser gets a stable `auth.uid` Firestore rules
 * can pin writes to, without any sign-in UI.
 *
 * Safe to call from multiple places concurrently — the in-flight promise is
 * memoized so we never fire duplicate `signInAnonymously` requests.
 */

let inflight: Promise<User | null> | null = null;

function getAuthSafe() {
    const fb = CloudArchive.getFirebase();
    if (!fb) return null;
    try {
        return getAuth(fb.app);
    } catch (e) {
        console.warn('ensureAnonUser: getAuth failed', e);
        return null;
    }
}

/**
 * Wait for the first `onAuthStateChanged` callback so subsequent calls don't
 * kick off another anonymous sign-in when we're already signed in from a prior
 * session (Firebase Auth persists across reloads by default).
 */
function waitForInitialAuthState(auth: ReturnType<typeof getAuth>): Promise<User | null> {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                resolve(user ?? null);
            },
            (err) => {
                console.warn('ensureAnonUser: onAuthStateChanged error', err);
                unsubscribe();
                resolve(null);
            }
        );
    });
}

/**
 * Ensure the current browser has an authenticated Firebase user (anonymous if
 * nothing else signed them in). Returns `null` when Firebase isn't available
 * (offline / config missing) so callers can degrade gracefully.
 *
 * Idempotent: concurrent callers share the same in-flight promise, and a
 * resolved user is reused without triggering another sign-in.
 */
export function ensureAnonUser(): Promise<User | null> {
    if (inflight) return inflight;

    const auth = getAuthSafe();
    if (!auth) return Promise.resolve(null);

    if (auth.currentUser) return Promise.resolve(auth.currentUser);

    inflight = (async () => {
        try {
            const existing = await waitForInitialAuthState(auth);
            if (existing) return existing;
            const cred = await signInAnonymously(auth);
            return cred.user ?? null;
        } catch (e) {
            console.warn('ensureAnonUser: signInAnonymously failed', e);
            return null;
        } finally {
            // Clear after resolution so later calls observe the cached
            // `auth.currentUser` fast-path (and so failures can be retried).
            inflight = null;
        }
    })();

    return inflight;
}

/** Test-only: reset the in-flight cache between tests. */
export function _resetAnonAuthForTests() {
    inflight = null;
}
