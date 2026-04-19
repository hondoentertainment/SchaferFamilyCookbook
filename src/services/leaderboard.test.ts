import { describe, it, expect, beforeEach, vi } from 'vitest';
import { submitScore, getTopScores, isLeaderboardAvailable } from './leaderboard';
import { CloudArchive } from './db';
import { _resetAnonAuthForTests } from './anonAuth';
import { setupLocalStorage } from '../test/utils';

describe('leaderboard service', () => {
    beforeEach(async () => {
        setupLocalStorage();
        localStorage.clear();
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
        _resetAnonAuthForTests();
        vi.clearAllMocks();

        // Restore default auth mocks (cleared by vi.clearAllMocks above).
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

    function activateFirebase() {
        localStorage.setItem('schafer_active_provider', 'firebase');
        localStorage.setItem(
            'schafer_firebase_config',
            JSON.stringify({ apiKey: 'test', projectId: 'test' })
        );
    }

    describe('isLeaderboardAvailable', () => {
        it('returns false when Firebase is not configured', () => {
            expect(isLeaderboardAvailable()).toBe(false);
        });

        it('returns true when Firebase config is present', () => {
            activateFirebase();
            expect(isLeaderboardAvailable()).toBe(true);
        });
    });

    describe('submitScore', () => {
        it('throws when Firebase is not configured', async () => {
            await expect(
                submitScore({
                    userId: 'u1',
                    displayName: 'Alice',
                    score: 3,
                    total: 5,
                })
            ).rejects.toThrow(/unavailable/i);
        });

        it('rejects empty displayName', async () => {
            activateFirebase();
            await expect(
                submitScore({
                    userId: 'u1',
                    displayName: '   ',
                    score: 3,
                    total: 5,
                })
            ).rejects.toThrow(/displayName/);
        });

        it('rejects out-of-range score', async () => {
            activateFirebase();
            await expect(
                submitScore({
                    userId: 'u1',
                    displayName: 'Alice',
                    score: 10,
                    total: 5,
                })
            ).rejects.toThrow(/between 0 and total/);
        });

        it('rejects non-positive total', async () => {
            activateFirebase();
            await expect(
                submitScore({
                    userId: 'u1',
                    displayName: 'Alice',
                    score: 0,
                    total: 0,
                })
            ).rejects.toThrow(/total must be positive/);
        });

        it('calls addDoc with a server timestamp + computed percentage', async () => {
            activateFirebase();
            const firestore = await import('firebase/firestore');
            await submitScore({
                userId: 'u1',
                displayName: 'Alice',
                avatarKey: 'cat',
                score: 4,
                total: 5,
            });
            expect(firestore.addDoc).toHaveBeenCalledTimes(1);
            const args = vi.mocked(firestore.addDoc).mock.calls[0];
            const payload = args[1] as Record<string, unknown>;
            expect(payload.displayName).toBe('Alice');
            // userId must match the anonymous auth uid — the caller-supplied
            // value is overridden to satisfy the Firestore rule.
            expect(payload.userId).toBe('anon-test-uid');
            expect(payload.avatarKey).toBe('cat');
            expect(payload.score).toBe(4);
            expect(payload.total).toBe(5);
            expect(payload.percentage).toBe(80);
            expect(payload.completedAt).toEqual({ __type: 'serverTimestamp' });
        });

        it('omits avatarKey when none provided and still uses auth uid', async () => {
            activateFirebase();
            const firestore = await import('firebase/firestore');
            await submitScore({
                userId: '',
                displayName: 'Bob',
                score: 0,
                total: 1,
            });
            const args = vi.mocked(firestore.addDoc).mock.calls[0];
            const payload = args[1] as Record<string, unknown>;
            expect(payload.userId).toBe('anon-test-uid');
            expect('avatarKey' in payload).toBe(false);
        });

        it('awaits anonymous auth before writing', async () => {
            activateFirebase();
            const firestore = await import('firebase/firestore');
            const auth = await import('firebase/auth');

            let resolveSignIn: (v: { user: { uid: string } }) => void = () => {};
            const signInPromise = new Promise<{ user: { uid: string } }>((r) => {
                resolveSignIn = r;
            });
            vi.mocked(auth.signInAnonymously).mockReturnValueOnce(
                signInPromise as unknown as ReturnType<typeof auth.signInAnonymously>,
            );

            const pending = submitScore({
                userId: 'u1',
                displayName: 'Alice',
                score: 1,
                total: 2,
            });
            // Flush microtasks so signInAnonymously has been invoked but its
            // promise is still pending. addDoc must not be called yet.
            await new Promise((r) => setTimeout(r, 0));
            expect(firestore.addDoc).not.toHaveBeenCalled();

            resolveSignIn({ user: { uid: 'late-uid' } });
            await pending;

            const args = vi.mocked(firestore.addDoc).mock.calls[0];
            const payload = args[1] as Record<string, unknown>;
            expect(payload.userId).toBe('late-uid');
        });

        it('throws when anonymous auth fails (e.g. offline)', async () => {
            activateFirebase();
            const auth = await import('firebase/auth');
            // Simulate getAuth returning nothing useful / sign-in throwing.
            vi.mocked(auth.signInAnonymously).mockRejectedValueOnce(
                new Error('network down'),
            );
            // And ensure the persisted-state path also resolves to null.
            vi.mocked(auth.onAuthStateChanged).mockImplementationOnce(((_a: unknown, cb: (u: unknown) => void) => {
                Promise.resolve().then(() => cb(null));
                return () => {};
            }) as typeof auth.onAuthStateChanged);

            await expect(
                submitScore({
                    userId: 'u1',
                    displayName: 'Alice',
                    score: 1,
                    total: 2,
                }),
            ).rejects.toThrow(/anonymous auth failed/i);
        });
    });

    describe('getTopScores', () => {
        it('throws when Firebase is not configured', async () => {
            await expect(getTopScores()).rejects.toThrow(/unavailable/i);
        });

        it('queries the triviaScores collection with score/completedAt ordering', async () => {
            activateFirebase();
            const firestore = await import('firebase/firestore');
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 's1',
                        data: () => ({
                            userId: 'u1',
                            displayName: 'Alice',
                            avatarKey: 'fox',
                            score: 5,
                            total: 5,
                            percentage: 100,
                            completedAt: { seconds: 1700000000, nanoseconds: 0 },
                        }),
                    },
                    {
                        id: 's2',
                        data: () => ({
                            userId: 'u2',
                            displayName: 'Bob',
                            score: 3,
                            total: 5,
                            percentage: 60,
                            completedAt: null,
                        }),
                    },
                ],
            } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

            const rows = await getTopScores(10);
            expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'triviaScores');
            expect(firestore.orderBy).toHaveBeenCalledWith('score', 'desc');
            expect(firestore.orderBy).toHaveBeenCalledWith('completedAt', 'asc');
            expect(firestore.limit).toHaveBeenCalledWith(10);
            expect(rows).toHaveLength(2);
            expect(rows[0]).toMatchObject({
                id: 's1',
                displayName: 'Alice',
                score: 5,
                total: 5,
                percentage: 100,
                avatarKey: 'fox',
            });
            expect(rows[0].completedAt).toContain('2023');
            expect(rows[1].percentage).toBe(60);
            expect(rows[1].avatarKey).toBeUndefined();
        });

        it('normalizes malformed rows to sensible defaults', async () => {
            activateFirebase();
            const firestore = await import('firebase/firestore');
            vi.mocked(firestore.getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'bad',
                        data: () => ({}),
                    },
                ],
            } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);
            const rows = await getTopScores();
            expect(rows[0].displayName).toBe('Anonymous');
            expect(rows[0].score).toBe(0);
            expect(rows[0].total).toBe(1);
            expect(rows[0].percentage).toBe(0);
        });
    });
});
