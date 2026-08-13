import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as firestore from 'firebase/firestore';
import { refreshFamilyPrefs } from './familyPrefs';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';
import { getFamilyPrefsCache, FAMILY_PREFS_UPDATED_EVENT } from '../utils/familyPrefsCache';

describe('familyPrefs service', () => {
    beforeEach(() => {
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

    it('returns false when Firebase is not configured', async () => {
        expect(await refreshFamilyPrefs()).toBe(false);
        expect(getFamilyPrefsCache()).toBeNull();
    });

    it('fetches all userPrefs docs into the family cache', async () => {
        activateFirebase();
        vi.mocked(firestore.getDocs).mockResolvedValueOnce({
            docs: [
                {
                    id: 'dawn',
                    data: () => ({
                        displayName: 'Dawn',
                        ratings: { r1: 5, r2: 99, r3: 'bad' },
                        notes: [
                            {
                                id: 'n1',
                                recipeId: 'r1',
                                userName: 'Dawn',
                                text: 'Use browned butter.',
                                timestamp: '2026-06-01T00:00:00.000Z',
                            },
                            { id: 'broken', text: '' },
                        ],
                    }),
                },
                { id: 'wren', data: () => ({ ratings: { r1: 4 } }) },
            ],
        } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

        expect(await refreshFamilyPrefs()).toBe(true);

        const cache = getFamilyPrefsCache();
        expect(cache?.members).toHaveLength(2);
        const dawn = cache?.members.find((m) => m.userId === 'dawn');
        expect(dawn?.displayName).toBe('Dawn');
        // Out-of-range clamped, non-numeric dropped, malformed notes dropped.
        expect(dawn?.ratings).toEqual({ r1: 5, r2: 5 });
        expect(dawn?.notes).toHaveLength(1);
        expect(dawn?.notes[0]?.text).toBe('Use browned butter.');
        const wren = cache?.members.find((m) => m.userId === 'wren');
        expect(wren?.displayName).toBeUndefined();
        expect(wren?.ratings).toEqual({ r1: 4 });
    });

    it('dispatches the family-prefs-updated event after a successful refresh', async () => {
        activateFirebase();
        const listener = vi.fn();
        window.addEventListener(FAMILY_PREFS_UPDATED_EVENT, listener);
        vi.mocked(firestore.getDocs).mockResolvedValueOnce({
            docs: [],
        } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);
        await refreshFamilyPrefs();
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(FAMILY_PREFS_UPDATED_EVENT, listener);
    });

    it('returns false and keeps the old cache when the fetch fails', async () => {
        activateFirebase();
        vi.mocked(firestore.getDocs).mockRejectedValueOnce(new Error('offline'));
        expect(await refreshFamilyPrefs()).toBe(false);
        expect(getFamilyPrefsCache()).toBeNull();
    });
});
