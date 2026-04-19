import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    deriveUserId,
    mergePrefs,
    fetchRemotePrefs,
    writeRemotePrefs,
    createDebouncedWriter,
} from './userPrefsSync';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

describe('userPrefsSync', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
        vi.clearAllMocks();
    });

    describe('deriveUserId', () => {
        it('slugifies a display name', () => {
            expect(deriveUserId('Grandma Joan')).toBe('grandma-joan');
        });

        it('collapses whitespace and non-alphanumerics', () => {
            expect(deriveUserId('  Grandma   Joan!!  ')).toBe('grandma-joan');
        });

        it('strips diacritics', () => {
            expect(deriveUserId('José')).toBe('jose');
        });

        it('returns null for empty or nullish input', () => {
            expect(deriveUserId('')).toBeNull();
            expect(deriveUserId(null)).toBeNull();
            expect(deriveUserId(undefined)).toBeNull();
            expect(deriveUserId('   ')).toBeNull();
            expect(deriveUserId('!!!')).toBeNull();
        });

        it('is stable across case variants', () => {
            expect(deriveUserId('KYLE')).toBe(deriveUserId('kyle'));
            expect(deriveUserId('Kyle')).toBe(deriveUserId('kyle'));
        });
    });

    describe('mergePrefs', () => {
        it('unions favorites from both sides', () => {
            const merged = mergePrefs(
                { favorites: ['a', 'b'], ratings: {} },
                { favorites: ['b', 'c'], ratings: {} }
            );
            expect([...merged.favorites].sort()).toEqual(['a', 'b', 'c']);
        });

        it('prefers remote ratings over local for overlapping recipe ids', () => {
            const merged = mergePrefs(
                { favorites: [], ratings: { r1: 3, r2: 5 } },
                { favorites: [], ratings: { r1: 4, r3: 2 } }
            );
            expect(merged.ratings).toEqual({ r1: 4, r2: 5, r3: 2 });
        });

        it('returns empty prefs for two empty inputs', () => {
            const merged = mergePrefs(
                { favorites: [], ratings: {} },
                { favorites: [], ratings: {} }
            );
            expect(merged.favorites).toEqual([]);
            expect(merged.ratings).toEqual({});
        });
    });

    describe('fetchRemotePrefs (no firebase configured)', () => {
        it('returns null when firebase is not configured', async () => {
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });

        it('returns null for an empty userId', async () => {
            const result = await fetchRemotePrefs('');
            expect(result).toBeNull();
        });
    });

    describe('writeRemotePrefs (no firebase configured)', () => {
        it('returns false silently when firebase is not configured', async () => {
            const ok = await writeRemotePrefs('grandma-joan', { favorites: ['a'], ratings: { r1: 4 } });
            expect(ok).toBe(false);
        });

        it('returns false for an empty userId even if firebase is configured', async () => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem('schafer_firebase_config', JSON.stringify({ apiKey: 'k', projectId: 'p' }));
            const ok = await writeRemotePrefs('', { favorites: [], ratings: {} });
            expect(ok).toBe(false);
        });
    });

    describe('fetchRemotePrefs (firebase configured)', () => {
        beforeEach(() => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('returns null when the doc does not exist', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });

        it('parses a well-formed remote doc', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    favorites: ['r1', 'r2'],
                    ratings: { r1: 5, r2: 3 },
                }),
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toEqual({
                favorites: ['r1', 'r2'],
                ratings: { r1: 5, r2: 3 },
            });
        });

        it('filters bogus favorites and clamps ratings', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    favorites: ['r1', 42, null, 'r2'],
                    ratings: { r1: 8, r2: 'nope', r3: 0, r4: 3 },
                }),
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result?.favorites).toEqual(['r1', 'r2']);
            expect(result?.ratings).toEqual({ r1: 5, r3: 1, r4: 3 });
        });

        it('returns null on read errors without throwing', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockRejectedValueOnce(new Error('offline'));
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });
    });

    describe('writeRemotePrefs (firebase configured)', () => {
        beforeEach(() => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('calls setDoc with favorites + ratings + merge option', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValueOnce(undefined as unknown as void);
            const ok = await writeRemotePrefs('grandma-joan', {
                favorites: ['r1', 'r1', 'r2'],
                ratings: { r1: 4 },
            });
            expect(ok).toBe(true);
            expect(setDocSpy).toHaveBeenCalled();
            const [, payload, options] = setDocSpy.mock.calls[setDocSpy.mock.calls.length - 1];
            const typed = payload as { favorites: string[]; ratings: Record<string, number> };
            expect([...typed.favorites].sort()).toEqual(['r1', 'r2']);
            expect(typed.ratings).toEqual({ r1: 4 });
            expect(options).toEqual({ merge: true });
        });

        it('returns false on write errors', async () => {
            const firestore = await import('firebase/firestore');
            vi.mocked(firestore.setDoc).mockRejectedValueOnce(new Error('network down'));
            const ok = await writeRemotePrefs('grandma-joan', { favorites: [], ratings: {} });
            expect(ok).toBe(false);
        });
    });

    describe('createDebouncedWriter', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('coalesces rapid schedules into a single write after the delay', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(500);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: {} });
            writer.schedule('grandma-joan', { favorites: ['r1', 'r2'], ratings: {} });
            writer.schedule('grandma-joan', { favorites: ['r1', 'r2', 'r3'], ratings: {} });

            expect(setDocSpy).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).toHaveBeenCalledTimes(1);
            const [, payload] = setDocSpy.mock.calls[0];
            const typed = payload as { favorites: string[] };
            expect([...typed.favorites].sort()).toEqual(['r1', 'r2', 'r3']);
        });

        it('does nothing for an empty userId', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(100);
            writer.schedule('', { favorites: ['r1'], ratings: {} });
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).not.toHaveBeenCalled();
        });

        it('cancel prevents a pending write', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(500);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: {} });
            writer.cancel('grandma-joan');
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).not.toHaveBeenCalled();
        });

        it('flush immediately writes a pending payload', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(10_000);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: { r1: 4 } });
            const ok = await writer.flush('grandma-joan');

            expect(setDocSpy).toHaveBeenCalledTimes(1);
            expect(ok).toBe(true);
        });
    });
});
