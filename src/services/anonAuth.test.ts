import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureAnonUser, _resetAnonAuthForTests } from './anonAuth';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

function activateFirebase() {
    localStorage.setItem('schafer_active_provider', 'firebase');
    localStorage.setItem(
        'schafer_firebase_config',
        JSON.stringify({ apiKey: 'test', projectId: 'test' }),
    );
}

describe('ensureAnonUser', () => {
    beforeEach(async () => {
        setupLocalStorage();
        localStorage.clear();
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
        _resetAnonAuthForTests();
        vi.clearAllMocks();

        // Restore default auth mocks (cleared above).
        const auth = await import('firebase/auth');
        vi.mocked(auth.getAuth).mockReturnValue({ currentUser: null } as unknown as ReturnType<typeof auth.getAuth>);
        vi.mocked(auth.signInAnonymously).mockResolvedValue({
            user: { uid: 'anon-test-uid', isAnonymous: true },
        } as unknown as Awaited<ReturnType<typeof auth.signInAnonymously>>);
        vi.mocked(auth.onAuthStateChanged).mockImplementation(((_auth: unknown, cb: (u: unknown) => void) => {
            Promise.resolve().then(() => cb(null));
            return () => {};
        }) as typeof auth.onAuthStateChanged);
    });

    it('returns null when Firebase is not configured (offline)', async () => {
        const user = await ensureAnonUser();
        expect(user).toBeNull();
    });

    it('signs in anonymously and returns the user when Firebase is configured', async () => {
        activateFirebase();
        const user = await ensureAnonUser();
        expect(user).not.toBeNull();
        expect(user?.uid).toBe('anon-test-uid');
        const auth = await import('firebase/auth');
        expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('memoizes the in-flight promise so concurrent callers share it', async () => {
        activateFirebase();
        const auth = await import('firebase/auth');
        let resolveSignIn: (v: { user: { uid: string } }) => void = () => {};
        const signInPromise = new Promise<{ user: { uid: string } }>((r) => {
            resolveSignIn = r;
        });
        vi.mocked(auth.signInAnonymously).mockReturnValueOnce(
            signInPromise as unknown as ReturnType<typeof auth.signInAnonymously>,
        );

        const p1 = ensureAnonUser();
        const p2 = ensureAnonUser();
        const p3 = ensureAnonUser();

        // Let the initial onAuthStateChanged microtask flush so signInAnonymously
        // is actually invoked, then resolve its promise.
        await new Promise((r) => setTimeout(r, 0));
        resolveSignIn({ user: { uid: 'shared-uid' } });

        const [u1, u2, u3] = await Promise.all([p1, p2, p3]);
        expect(u1?.uid).toBe('shared-uid');
        expect(u2?.uid).toBe('shared-uid');
        expect(u3?.uid).toBe('shared-uid');
        // Exactly one signInAnonymously call for three concurrent requests.
        expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('reuses an already-signed-in user without calling signInAnonymously', async () => {
        activateFirebase();
        const auth = await import('firebase/auth');
        vi.mocked(auth.getAuth).mockReturnValue({
            currentUser: { uid: 'existing-uid', isAnonymous: true },
        } as unknown as ReturnType<typeof auth.getAuth>);

        const user = await ensureAnonUser();
        expect(user?.uid).toBe('existing-uid');
        expect(auth.signInAnonymously).not.toHaveBeenCalled();
    });

    it('picks up a persisted user via onAuthStateChanged before signing in', async () => {
        activateFirebase();
        const auth = await import('firebase/auth');
        vi.mocked(auth.onAuthStateChanged).mockImplementationOnce(((_a: unknown, cb: (u: unknown) => void) => {
            Promise.resolve().then(() => cb({ uid: 'persisted-uid', isAnonymous: true }));
            return () => {};
        }) as typeof auth.onAuthStateChanged);

        const user = await ensureAnonUser();
        expect(user?.uid).toBe('persisted-uid');
        expect(auth.signInAnonymously).not.toHaveBeenCalled();
    });

    it('returns null when signInAnonymously throws', async () => {
        activateFirebase();
        const auth = await import('firebase/auth');
        vi.mocked(auth.signInAnonymously).mockRejectedValueOnce(new Error('network down'));

        const user = await ensureAnonUser();
        expect(user).toBeNull();
    });
});
