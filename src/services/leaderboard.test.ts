import { describe, it, expect, beforeEach, vi } from 'vitest';
import { submitScore, getTopScores, isLeaderboardAvailable } from './leaderboard';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

describe('leaderboard service', () => {
    beforeEach(async () => {
        setupLocalStorage();
        localStorage.clear();
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
        vi.clearAllMocks();
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
            expect(payload.userId).toBe('u1');
            expect(payload.avatarKey).toBe('cat');
            expect(payload.score).toBe(4);
            expect(payload.total).toBe(5);
            expect(payload.percentage).toBe(80);
            expect(payload.completedAt).toEqual({ __type: 'serverTimestamp' });
        });

        it('omits avatarKey when none provided and defaults empty userId to anonymous', async () => {
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
            expect(payload.userId).toBe('anonymous');
            expect('avatarKey' in payload).toBe(false);
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
