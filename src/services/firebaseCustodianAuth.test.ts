import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    subscribeFirebaseCustodian,
    signInCustodianWithGoogle,
    signOutFirebaseCustodian,
    type CustodianAuthState,
} from './firebaseCustodianAuth';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

// ---------------------------------------------------------------------------
// Mock firebase/auth in its entirety for this file.
// ---------------------------------------------------------------------------

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({ currentUser: null })),
    // Must be a real class so `new GoogleAuthProvider()` works.
    GoogleAuthProvider: vi.fn().mockImplementation(function (this: object) {
        return this;
    }),
    signInWithPopup: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    onAuthStateChanged: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Manufacture a minimal Firebase User mock with controllable getIdTokenResult. */
function makeUser(opts: {
    email?: string;
    claims?: Record<string, unknown>;
    rejectToken?: boolean;
}): any {
    return {
        email: opts.email ?? 'user@example.com',
        uid: 'uid-123',
        getIdTokenResult: opts.rejectToken
            ? vi.fn().mockRejectedValue(new Error('token error'))
            : vi.fn().mockResolvedValue({ claims: opts.claims ?? {} }),
    };
}

/** Make CloudArchive.getFirebase() return a plausible firebase instance. */
function enableFirebase() {
    setupLocalStorage();
    localStorage.setItem('schafer_active_provider', 'firebase');
    localStorage.setItem(
        'schafer_firebase_config',
        JSON.stringify({ apiKey: 'test', projectId: 'test' })
    );
    CloudArchive._firebaseApp = null;
    CloudArchive._firestore = null;
    CloudArchive._storage = null;
}

/** Reset CloudArchive to a state where getFirebase() returns null. */
function disableFirebase() {
    setupLocalStorage();
    localStorage.clear();
    CloudArchive._firebaseApp = null;
    CloudArchive._firestore = null;
    CloudArchive._storage = null;
}

// ---------------------------------------------------------------------------

describe('firebaseCustodianAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        disableFirebase();
    });

    // -------------------------------------------------------------------------
    // subscribeFirebaseCustodian
    // -------------------------------------------------------------------------

    describe('subscribeFirebaseCustodian', () => {
        it('immediately calls callback with unauthenticated state when Firebase is not configured', () => {
            // getFirebase() returns null — no firebase/auth interaction at all.
            const callback = vi.fn();
            const unsubscribe = subscribeFirebaseCustodian(callback);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({ user: null, isAdmin: false });
            // The returned unsubscribe is a no-op function (not the real onAuthStateChanged cleanup).
            expect(typeof unsubscribe).toBe('function');
        });

        it('returns a no-op unsubscribe when Firebase is not configured', () => {
            const callback = vi.fn();
            const unsubscribe = subscribeFirebaseCustodian(callback);
            // Calling it should not throw
            expect(() => unsubscribe()).not.toThrow();
        });

        it('subscribes to onAuthStateChanged when Firebase is configured', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const mockUnsubscribe = vi.fn();
            vi.mocked(onAuthStateChanged).mockReturnValue(mockUnsubscribe as any);

            const callback = vi.fn();
            subscribeFirebaseCustodian(callback);

            expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
            // The auth object passed in is whatever getAuth() returned.
            const { getAuth } = await import('firebase/auth');
            expect(onAuthStateChanged).toHaveBeenCalledWith(
                vi.mocked(getAuth).mock.results[0].value,
                expect.any(Function)
            );
        });

        it('returns the onAuthStateChanged unsubscribe function', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const mockUnsubscribe = vi.fn();
            vi.mocked(onAuthStateChanged).mockReturnValue(mockUnsubscribe as any);

            const unsubscribe = subscribeFirebaseCustodian(vi.fn());
            expect(unsubscribe).toBe(mockUnsubscribe);
        });

        it('calls callback with isAdmin=false for unauthenticated (null) user', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(null);
                return vi.fn();
            });

            const callback = vi.fn();
            subscribeFirebaseCustodian(callback);

            expect(callback).toHaveBeenCalledWith({ user: null, isAdmin: false });
        });

        it('sets isAdmin=true when custom claims include admin===true', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const user = makeUser({ claims: { admin: true } });

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(user);
                return vi.fn();
            });

            const states: CustodianAuthState[] = [];
            subscribeFirebaseCustodian((s) => states.push(s));

            // getIdTokenResult is async — wait for the microtask.
            await vi.waitFor(() => expect(states.length).toBeGreaterThan(0));

            expect(states[0].isAdmin).toBe(true);
            expect(states[0].user).toBe(user);
        });

        it('sets isAdmin=false when claims exist but admin is not true', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const user = makeUser({ claims: { admin: false, role: 'viewer' } });

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(user);
                return vi.fn();
            });

            const states: CustodianAuthState[] = [];
            subscribeFirebaseCustodian((s) => states.push(s));

            await vi.waitFor(() => expect(states.length).toBeGreaterThan(0));
            expect(states[0].isAdmin).toBe(false);
        });

        it('sets isAdmin=false when claims do not include the admin key at all', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const user = makeUser({ claims: {} });

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(user);
                return vi.fn();
            });

            const states: CustodianAuthState[] = [];
            subscribeFirebaseCustodian((s) => states.push(s));

            await vi.waitFor(() => expect(states.length).toBeGreaterThan(0));
            expect(states[0].isAdmin).toBe(false);
            expect(states[0].user).toBe(user);
        });

        it('falls back to isAdmin=false and still calls callback when getIdTokenResult rejects', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const user = makeUser({ rejectToken: true });
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(user);
                return vi.fn();
            });

            const states: CustodianAuthState[] = [];
            subscribeFirebaseCustodian((s) => states.push(s));

            await vi.waitFor(() => expect(states.length).toBeGreaterThan(0));
            expect(states[0].isAdmin).toBe(false);
            expect(states[0].user).toBe(user);
            // The service should warn about the failure
            expect(warnSpy).toHaveBeenCalled();
        });

        it('forces a token refresh (true) when calling getIdTokenResult', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const user = makeUser({ claims: { admin: true } });

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                handler(user);
                return vi.fn();
            });

            subscribeFirebaseCustodian(vi.fn());
            await vi.waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalledWith(true));
        });

        it('re-evaluates claims each time the auth state changes', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            let capturedHandler: ((user: any) => void) | null = null;

            vi.mocked(onAuthStateChanged).mockImplementation((_auth, handler: any) => {
                capturedHandler = handler;
                return vi.fn();
            });

            const states: CustodianAuthState[] = [];
            subscribeFirebaseCustodian((s) => states.push(s));

            // First call — authenticated with admin
            const adminUser = makeUser({ claims: { admin: true } });
            capturedHandler!(adminUser);
            await vi.waitFor(() => expect(states).toHaveLength(1));
            expect(states[0].isAdmin).toBe(true);

            // Second call — same user, no admin claim (simulates token refresh with revoked claim)
            const regularUser = makeUser({ claims: {} });
            capturedHandler!(regularUser);
            await vi.waitFor(() => expect(states).toHaveLength(2));
            expect(states[1].isAdmin).toBe(false);
        });

        it('cleans up the auth subscription when the returned unsubscribe is called', async () => {
            enableFirebase();
            const { onAuthStateChanged } = await import('firebase/auth');
            const mockUnsubscribe = vi.fn();
            vi.mocked(onAuthStateChanged).mockReturnValue(mockUnsubscribe as any);

            const unsubscribe = subscribeFirebaseCustodian(vi.fn());
            unsubscribe();

            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // signInCustodianWithGoogle
    // -------------------------------------------------------------------------

    describe('signInCustodianWithGoogle', () => {
        it('throws when Firebase is not configured', async () => {
            await expect(signInCustodianWithGoogle()).rejects.toThrow('Firebase is not configured');
        });

        it('calls signInWithPopup with a GoogleAuthProvider when Firebase is configured', async () => {
            enableFirebase();
            const { signInWithPopup, GoogleAuthProvider, getAuth } = await import('firebase/auth');

            await signInCustodianWithGoogle();

            expect(GoogleAuthProvider).toHaveBeenCalledTimes(1);
            expect(signInWithPopup).toHaveBeenCalledTimes(1);
            expect(signInWithPopup).toHaveBeenCalledWith(
                vi.mocked(getAuth).mock.results[0].value,
                expect.anything() // the GoogleAuthProvider instance
            );
        });

        it('propagates errors from signInWithPopup to the caller', async () => {
            enableFirebase();
            const { signInWithPopup } = await import('firebase/auth');
            vi.mocked(signInWithPopup).mockRejectedValueOnce(new Error('popup closed'));

            await expect(signInCustodianWithGoogle()).rejects.toThrow('popup closed');
        });
    });

    // -------------------------------------------------------------------------
    // signOutFirebaseCustodian
    // -------------------------------------------------------------------------

    describe('signOutFirebaseCustodian', () => {
        it('does nothing when Firebase is not configured', async () => {
            const { signOut } = await import('firebase/auth');
            // Should not throw
            await expect(signOutFirebaseCustodian()).resolves.toBeUndefined();
            expect(signOut).not.toHaveBeenCalled();
        });

        it('calls signOut when there is a current user', async () => {
            enableFirebase();
            const { getAuth, signOut } = await import('firebase/auth');
            const mockAuth = { currentUser: makeUser({}) };
            vi.mocked(getAuth).mockReturnValue(mockAuth as any);

            await signOutFirebaseCustodian();

            expect(signOut).toHaveBeenCalledTimes(1);
            expect(signOut).toHaveBeenCalledWith(mockAuth);
        });

        it('does NOT call signOut when there is no current user', async () => {
            enableFirebase();
            const { getAuth, signOut } = await import('firebase/auth');
            vi.mocked(getAuth).mockReturnValue({ currentUser: null } as any);

            await signOutFirebaseCustodian();

            expect(signOut).not.toHaveBeenCalled();
        });

        it('propagates errors from signOut to the caller', async () => {
            enableFirebase();
            const { getAuth, signOut } = await import('firebase/auth');
            vi.mocked(getAuth).mockReturnValue({ currentUser: makeUser({}) } as any);
            vi.mocked(signOut).mockRejectedValueOnce(new Error('network error'));

            await expect(signOutFirebaseCustodian()).rejects.toThrow('network error');
        });
    });
});
