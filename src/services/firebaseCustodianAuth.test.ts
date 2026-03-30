import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onAuthStateChanged, getAuth, signInWithPopup, signOut } from 'firebase/auth';
import { subscribeFirebaseCustodian, signInCustodianWithGoogle, signOutFirebaseCustodian } from './firebaseCustodianAuth';
import { CloudArchive } from './db';

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({ currentUser: null })),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
}));

vi.mock('./db', () => ({
    CloudArchive: {
        getFirebase: vi.fn(),
    },
}));

describe('firebaseCustodianAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('subscribeFirebaseCustodian', () => {
        it('should call back with null user when Firebase is not configured', () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue(null);
            const callback = vi.fn();

            const unsub = subscribeFirebaseCustodian(callback);

            expect(callback).toHaveBeenCalledWith({ user: null, isAdmin: false });
            expect(unsub).toBeTypeOf('function');
        });

        it('should subscribe to auth state changes when Firebase is configured', () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            const mockUnsub = vi.fn();
            vi.mocked(onAuthStateChanged).mockReturnValue(mockUnsub);
            const callback = vi.fn();

            const unsub = subscribeFirebaseCustodian(callback);

            expect(onAuthStateChanged).toHaveBeenCalled();
            expect(unsub).toBe(mockUnsub);
        });

        it('should report non-admin when user signs out', () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
                (cb as (user: null) => void)(null);
                return vi.fn();
            });
            const callback = vi.fn();

            subscribeFirebaseCustodian(callback);

            expect(callback).toHaveBeenCalledWith({ user: null, isAdmin: false });
        });

        it('should check admin claims when user is signed in', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            const mockUser = {
                email: 'test@example.com',
                getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true } }),
            };
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
                (cb as unknown as (user: typeof mockUser) => void)(mockUser);
                return vi.fn();
            });
            const callback = vi.fn();

            subscribeFirebaseCustodian(callback);

            // Wait for async getIdTokenResult
            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalledWith({ user: mockUser, isAdmin: true });
            });
        });

        it('should fall back to non-admin on claims fetch failure', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            const mockUser = {
                email: 'test@example.com',
                getIdTokenResult: vi.fn().mockRejectedValue(new Error('Network error')),
            };
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
                (cb as unknown as (user: typeof mockUser) => void)(mockUser);
                return vi.fn();
            });
            const callback = vi.fn();

            subscribeFirebaseCustodian(callback);

            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalledWith({ user: mockUser, isAdmin: false });
            });
        });
    });

    describe('signInCustodianWithGoogle', () => {
        it('should throw when Firebase is not configured', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue(null);

            await expect(signInCustodianWithGoogle()).rejects.toThrow('Firebase is not configured');
        });

        it('should call signInWithPopup with Google provider', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            vi.mocked(signInWithPopup).mockResolvedValue({} as any);

            await signInCustodianWithGoogle();

            expect(signInWithPopup).toHaveBeenCalled();
        });
    });

    describe('signOutFirebaseCustodian', () => {
        it('should not call signOut when no Firebase or no current user', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue(null);

            await signOutFirebaseCustodian();

            expect(signOut).not.toHaveBeenCalled();
        });

        it('should call signOut when user is signed in', async () => {
            vi.mocked(CloudArchive.getFirebase).mockReturnValue({
                app: {} as any,
                db: {} as any,
                storage: {} as any,
            });
            vi.mocked(getAuth).mockReturnValue({ currentUser: { uid: '123' } } as any);
            vi.mocked(signOut).mockResolvedValue(undefined);

            await signOutFirebaseCustodian();

            expect(signOut).toHaveBeenCalled();
        });
    });
});
