import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { STORAGE_KEYS } from '../constants/storage';
import type { RecipeNote, RecipeRating } from '../types';
import type { UserPrefsPayload } from './userPrefsSync';

const { scheduleMock, listeners, getProviderMock, fetchRemotePrefsMock } = vi.hoisted(() => ({
    scheduleMock: vi.fn(),
    listeners: [] as Array<() => void>,
    getProviderMock: vi.fn(() => 'firebase'),
    fetchRemotePrefsMock: vi.fn(),
}));

vi.mock('./db', () => ({ CloudArchive: { getProvider: getProviderMock } }));

// Keep the real merge logic (mergePrefs/deriveUserId/etc.); stub only the
// network fetch, the debounced writer, and the change bus.
vi.mock('./userPrefsSync', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./userPrefsSync')>();
    return {
        ...actual,
        fetchRemotePrefs: fetchRemotePrefsMock,
        createDebouncedWriter: () => ({ schedule: scheduleMock, flush: vi.fn() }),
        subscribeToPrefsChanges: (l: () => void) => {
            listeners.push(l);
            return () => {
                const i = listeners.indexOf(l);
                if (i >= 0) listeners.splice(i, 1);
            };
        },
    };
});

import { useUserPrefsSync, type UserPrefsSyncStatus } from './useUserPrefsSync';

const emptyRemote = (): UserPrefsPayload => ({
    favorites: [],
    ratings: {},
    collections: [],
    mealPlan: [],
    groceryList: [],
    notes: [],
    deletedNoteIds: [],
});

const makeNote = (overrides: Partial<RecipeNote> = {}): RecipeNote => ({
    id: 'n1',
    recipeId: 'r1',
    userName: 'Alice',
    text: 'Add more butter',
    timestamp: '2026-07-01T00:00:00.000Z',
    ...overrides,
});

// The global test setup stubs localStorage with inert vi.fn()s; these tests
// exercise real read-modify-write cycles, so install a working in-memory store.
const makeStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
            store.set(k, String(v));
        },
        removeItem: (k: string) => {
            store.delete(k);
        },
        clear: () => store.clear(),
        get length() {
            return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
    } as Storage;
};

describe('useUserPrefsSync', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', makeStorage());
        scheduleMock.mockReset();
        fetchRemotePrefsMock.mockReset();
        getProviderMock.mockReturnValue('firebase');
        listeners.length = 0;
    });

    it('reports "local" and skips fetching when there is no user', () => {
        const statuses: UserPrefsSyncStatus[] = [];
        renderHook(() => useUserPrefsSync(null, { onSyncStatus: (s) => statuses.push(s) }));
        expect(statuses).toEqual(['local']);
        expect(fetchRemotePrefsMock).not.toHaveBeenCalled();
    });

    it('reports "local" and skips fetching when the provider is not firebase', () => {
        getProviderMock.mockReturnValue('local');
        const statuses: UserPrefsSyncStatus[] = [];
        renderHook(() => useUserPrefsSync('Alice', { onSyncStatus: (s) => statuses.push(s) }));
        expect(statuses).toEqual(['local']);
        expect(fetchRemotePrefsMock).not.toHaveBeenCalled();
    });

    it('reports syncing → synced and schedules nothing when both sides are empty', async () => {
        fetchRemotePrefsMock.mockResolvedValueOnce(null);
        const statuses: UserPrefsSyncStatus[] = [];
        renderHook(() => useUserPrefsSync('Alice', { onSyncStatus: (s) => statuses.push(s) }));

        await waitFor(() => expect(statuses).toEqual(['syncing', 'synced']));
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('seeds the cloud with local prefs when remote has no doc yet', async () => {
        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(['r7']));
        fetchRemotePrefsMock.mockResolvedValueOnce(null);

        renderHook(() => useUserPrefsSync('Alice'));

        await waitFor(() => expect(scheduleMock).toHaveBeenCalledTimes(1));
        const [userId, payload] = scheduleMock.mock.calls[0] as [string, UserPrefsPayload];
        expect(userId).toBe('alice');
        expect(payload.favorites).toEqual(['r7']);
        expect(payload.displayName).toBe('Alice');
    });

    it('hydrates local storage from remote and calls onHydrated without re-uploading', async () => {
        fetchRemotePrefsMock.mockResolvedValueOnce({
            ...emptyRemote(),
            favorites: ['r1', 'r2'],
            ratings: { r1: 5 },
        });
        const onHydrated = vi.fn();
        const statuses: UserPrefsSyncStatus[] = [];

        renderHook(() => useUserPrefsSync('Alice', { onHydrated, onSyncStatus: (s) => statuses.push(s) }));

        await waitFor(() => expect(onHydrated).toHaveBeenCalledTimes(1));
        expect(statuses).toEqual(['syncing', 'synced']);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites)!)).toEqual(['r1', 'r2']);
        const ratings = JSON.parse(localStorage.getItem(STORAGE_KEYS.ratings)!) as RecipeRating[];
        expect(ratings).toHaveLength(1);
        expect(ratings[0]).toMatchObject({ recipeId: 'r1', rating: 5, userName: 'Alice' });
        // Merged state equals remote → no write-back needed.
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('schedules a write-back when local has prefs the remote lacks', async () => {
        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(['r9']));
        fetchRemotePrefsMock.mockResolvedValueOnce({ ...emptyRemote(), favorites: ['r1'] });

        renderHook(() => useUserPrefsSync('Alice'));

        await waitFor(() => expect(scheduleMock).toHaveBeenCalledTimes(1));
        const [, payload] = scheduleMock.mock.calls[0] as [string, UserPrefsPayload];
        expect([...payload.favorites].sort()).toEqual(['r1', 'r9']);
        // Union also landed locally.
        expect((JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites)!) as string[]).sort()).toEqual(['r1', 'r9']);
    });

    it("replaces this user's notes from the merge but preserves other users' local notes", async () => {
        const bobNote = makeNote({ id: 'nb', userName: 'Bob', text: 'Dad loved this' });
        localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([bobNote]));
        const remoteAliceNote = makeNote({ id: 'na' });
        fetchRemotePrefsMock.mockResolvedValueOnce({ ...emptyRemote(), notes: [remoteAliceNote] });

        renderHook(() => useUserPrefsSync('Alice'));

        await waitFor(() => {
            const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.notes)!) as RecipeNote[];
            expect(notes.map((n) => n.id).sort()).toEqual(['na', 'nb']);
        });
    });

    it('drops remotely tombstoned notes during hydrate and records the tombstones', async () => {
        const deleted = makeNote({ id: 'gone' });
        localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([deleted]));
        fetchRemotePrefsMock.mockResolvedValueOnce({ ...emptyRemote(), deletedNoteIds: ['gone'] });

        renderHook(() => useUserPrefsSync('Alice'));

        await waitFor(() => {
            const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.notes)!) as RecipeNote[];
            expect(notes).toHaveLength(0);
        });
        const tombstones = JSON.parse(localStorage.getItem(STORAGE_KEYS.deletedNotes)!) as string[];
        expect(tombstones).toContain('gone');
    });

    it('schedules an upload when a local note is missing from the remote', async () => {
        const aliceNote = makeNote({ id: 'local-only' });
        localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([aliceNote]));
        fetchRemotePrefsMock.mockResolvedValueOnce(emptyRemote());

        renderHook(() => useUserPrefsSync('Alice'));

        await waitFor(() => expect(scheduleMock).toHaveBeenCalledTimes(1));
        const [, payload] = scheduleMock.mock.calls[0] as [string, UserPrefsPayload];
        expect(payload.notes?.map((n) => n.id)).toEqual(['local-only']);
    });

    it('reports "error" when the remote fetch rejects', async () => {
        fetchRemotePrefsMock.mockRejectedValueOnce(new Error('offline'));
        const statuses: UserPrefsSyncStatus[] = [];

        renderHook(() => useUserPrefsSync('Alice', { onSyncStatus: (s) => statuses.push(s) }));

        await waitFor(() => expect(statuses).toEqual(['syncing', 'error']));
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('schedules a debounced write when local prefs change', async () => {
        fetchRemotePrefsMock.mockResolvedValueOnce(null);
        renderHook(() => useUserPrefsSync('Alice'));
        await waitFor(() => expect(listeners.length).toBe(1));

        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(['r3']));
        act(() => listeners.forEach((l) => l()));

        await waitFor(() => expect(scheduleMock).toHaveBeenCalled());
        const [userId, payload] = scheduleMock.mock.calls.at(-1) as [string, UserPrefsPayload];
        expect(userId).toBe('alice');
        expect(payload.favorites).toEqual(['r3']);
    });

    it('does not subscribe to local changes when the provider is not firebase', () => {
        getProviderMock.mockReturnValue('local');
        renderHook(() => useUserPrefsSync('Alice'));
        expect(listeners.length).toBe(0);
    });

    it('unsubscribes from the change bus on unmount', async () => {
        fetchRemotePrefsMock.mockResolvedValueOnce(null);
        const { unmount } = renderHook(() => useUserPrefsSync('Alice'));
        await waitFor(() => expect(listeners.length).toBe(1));
        unmount();
        expect(listeners.length).toBe(0);
    });
});
