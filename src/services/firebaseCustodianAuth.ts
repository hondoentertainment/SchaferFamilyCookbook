import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { CloudArchive } from './db';

export type CustodianAuthState = {
    user: User | null;
    isAdmin: boolean;
};

function getAuthSafe() {
    const fb = CloudArchive.getFirebase();
    if (!fb) return null;
    return getAuth(fb.app);
}

/** Subscribe to Firebase Auth + refresh custom claims (admin) for custodian writes. */
export function subscribeFirebaseCustodian(callback: (s: CustodianAuthState) => void): () => void {
    const auth = getAuthSafe();
    if (!auth) {
        callback({ user: null, isAdmin: false });
        return () => {};
    }
    return onAuthStateChanged(auth, async (user) => {
        if (!user) {
            callback({ user: null, isAdmin: false });
            return;
        }
        try {
            const r = await user.getIdTokenResult(true);
            callback({ user, isAdmin: r.claims.admin === true });
        } catch {
            callback({ user, isAdmin: false });
        }
    });
}

export async function signInCustodianWithGoogle(): Promise<void> {
    const auth = getAuthSafe();
    if (!auth) throw new Error('Firebase is not configured');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

export async function signOutFirebaseCustodian(): Promise<void> {
    const auth = getAuthSafe();
    if (auth?.currentUser) {
        await signOut(auth);
    }
}
