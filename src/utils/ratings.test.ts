import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getAllRatings,
    getRatingsForRecipe,
    getAverageRating,
    getRatingCount,
    setRating,
    getUserRating,
    isFamilyApproved,
    getAllNotes,
    getNotesForRecipe,
    addNote,
    deleteNote,
    getDeletedNoteIds,
} from './ratings';

vi.mock('../services/userPrefsSync', () => ({
    notifyPrefsChanged: vi.fn(),
    deriveUserId: (displayName?: string | null) => {
        if (!displayName) return null;
        const slug = displayName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || null;
    },
}));

const FAMILY_CACHE_KEY = 'familyPrefs:v1';

function seedFamilyCache(members: unknown[]) {
    localStorage.setItem(
        FAMILY_CACHE_KEY,
        JSON.stringify({ fetchedAt: '2026-07-01T00:00:00.000Z', members })
    );
}

const RATINGS_KEY = 'schafer_ratings';
const NOTES_KEY = 'schafer_notes';

describe('ratings utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // -------------------------------------------------------------------------
    describe('getAllRatings', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getAllRatings()).toEqual([]);
        });

        it('parses and returns stored ratings', () => {
            const ratings = [
                { recipeId: 'r1', userName: 'Alice', rating: 4, timestamp: new Date().toISOString() },
                { recipeId: 'r2', userName: 'Bob', rating: 5, timestamp: new Date().toISOString() },
            ];
            localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
            const result = getAllRatings();
            expect(result).toHaveLength(2);
            expect(result[0].recipeId).toBe('r1');
            expect(result[1].userName).toBe('Bob');
        });

        it('returns an empty array for malformed JSON', () => {
            localStorage.setItem(RATINGS_KEY, 'not-valid-json{');
            expect(getAllRatings()).toEqual([]);
        });

        it('returns an empty array when stored value is an empty JSON array', () => {
            localStorage.setItem(RATINGS_KEY, '[]');
            expect(getAllRatings()).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getRatingsForRecipe', () => {
        it('returns ratings only for the given recipeId', () => {
            setRating('recipe-1', 'Alice', 4);
            setRating('recipe-2', 'Bob', 5);
            setRating('recipe-1', 'Carol', 3);

            const result = getRatingsForRecipe('recipe-1');
            expect(result).toHaveLength(2);
            result.forEach((r) => expect(r.recipeId).toBe('recipe-1'));
        });

        it('returns an empty array when no ratings exist for the recipe', () => {
            expect(getRatingsForRecipe('nonexistent-recipe')).toEqual([]);
        });

        it('returns an empty array when no ratings are stored at all', () => {
            expect(getRatingsForRecipe('recipe-1')).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getAverageRating', () => {
        it('returns 0 when there are no ratings', () => {
            expect(getAverageRating('recipe-1')).toBe(0);
        });

        it('returns the rating itself when there is a single rating', () => {
            setRating('recipe-1', 'Alice', 4);
            expect(getAverageRating('recipe-1')).toBe(4);
        });

        it('calculates the average of multiple ratings correctly', () => {
            setRating('recipe-1', 'Alice', 4);
            setRating('recipe-1', 'Bob', 2);
            expect(getAverageRating('recipe-1')).toBe(3);
        });

        it('computes a fractional average', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-1', 'Bob', 4);
            setRating('recipe-1', 'Carol', 3);
            // (5+4+3)/3 = 4
            expect(getAverageRating('recipe-1')).toBeCloseTo(4);
        });

        it('does not include ratings for other recipes', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-2', 'Bob', 1);
            expect(getAverageRating('recipe-1')).toBe(5);
        });
    });

    // -------------------------------------------------------------------------
    describe('getRatingCount', () => {
        it('returns 0 when no ratings exist', () => {
            expect(getRatingCount('recipe-1')).toBe(0);
        });

        it('returns the number of ratings for a recipe', () => {
            setRating('recipe-1', 'Alice', 3);
            setRating('recipe-1', 'Bob', 5);
            expect(getRatingCount('recipe-1')).toBe(2);
        });

        it('does not count ratings from other recipes', () => {
            setRating('recipe-1', 'Alice', 4);
            setRating('recipe-2', 'Bob', 5);
            expect(getRatingCount('recipe-1')).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('family aggregate merging', () => {
        it('includes cached family ratings in getRatingsForRecipe', () => {
            seedFamilyCache([
                { userId: 'dawn', displayName: 'Dawn', ratings: { 'recipe-1': 5 }, notes: [] },
                { userId: 'wren', ratings: { 'recipe-1': 4, 'recipe-2': 2 }, notes: [] },
            ]);
            const ratings = getRatingsForRecipe('recipe-1');
            expect(ratings).toHaveLength(2);
            expect(ratings.map((r) => r.userName).sort()).toEqual(['Dawn', 'Wren']);
            expect(getAverageRating('recipe-1')).toBe(4.5);
            expect(getRatingCount('recipe-1')).toBe(2);
        });

        it('local rating wins over the cached family entry for the same user', () => {
            seedFamilyCache([
                { userId: 'dawn', displayName: 'Dawn', ratings: { 'recipe-1': 2 }, notes: [] },
            ]);
            setRating('recipe-1', 'Dawn', 5);
            const ratings = getRatingsForRecipe('recipe-1');
            expect(ratings).toHaveLength(1);
            expect(ratings[0].rating).toBe(5);
        });

        it('family ratings count toward isFamilyApproved', () => {
            seedFamilyCache([
                { userId: 'dawn', ratings: { 'recipe-1': 5 }, notes: [] },
                { userId: 'wren', ratings: { 'recipe-1': 4 }, notes: [] },
            ]);
            expect(isFamilyApproved('recipe-1')).toBe(false);
            setRating('recipe-1', 'Harriet', 5);
            expect(isFamilyApproved('recipe-1')).toBe(true);
        });

        it('merges family notes into getNotesForRecipe, deduped by id', () => {
            seedFamilyCache([
                {
                    userId: 'dawn',
                    displayName: 'Dawn',
                    ratings: {},
                    notes: [
                        {
                            id: 'n-remote',
                            recipeId: 'recipe-1',
                            userName: 'Dawn',
                            text: 'Family tip',
                            timestamp: '2026-06-01T00:00:00.000Z',
                        },
                    ],
                },
            ]);
            addNote('recipe-1', 'Harriet', 'Local tip');
            const notes = getNotesForRecipe('recipe-1');
            expect(notes).toHaveLength(2);
            expect(notes.map((n) => n.text).sort()).toEqual(['Family tip', 'Local tip']);
        });

        it("falls back to the family cache for the user's own rating", () => {
            seedFamilyCache([
                { userId: 'dawn', displayName: 'Dawn', ratings: { 'recipe-1': 4 }, notes: [] },
            ]);
            expect(getUserRating('recipe-1', 'Dawn')).toBe(4);
            // A local rating still wins over the cached value.
            setRating('recipe-1', 'Dawn', 2);
            expect(getUserRating('recipe-1', 'Dawn')).toBe(2);
        });

        it('ignores malformed family cache members instead of crashing', () => {
            seedFamilyCache([
                { userId: 'broken' },
                { userId: 'dawn', ratings: { 'recipe-1': 5 }, notes: [] },
            ]);
            expect(getRatingCount('recipe-1')).toBe(1);
            expect(getNotesForRecipe('recipe-1')).toEqual([]);
        });

        it('records a tombstone when a note is deleted', () => {
            const notes = addNote('recipe-1', 'Harriet', 'Soon deleted');
            deleteNote(notes[0]!.id);
            expect(getDeletedNoteIds()).toEqual([notes[0]!.id]);
            expect(getNotesForRecipe('recipe-1')).toHaveLength(0);
        });

        it("excludes the current user's cached family notes so local deletes stick", () => {
            seedFamilyCache([
                {
                    userId: 'harriet',
                    displayName: 'Harriet',
                    ratings: {},
                    notes: [
                        {
                            id: 'n-deleted',
                            recipeId: 'recipe-1',
                            userName: 'Harriet',
                            text: 'Deleted on this device',
                            timestamp: '2026-06-01T00:00:00.000Z',
                        },
                    ],
                },
            ]);
            expect(getNotesForRecipe('recipe-1', 'Harriet')).toHaveLength(0);
            expect(getNotesForRecipe('recipe-1')).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('setRating', () => {
        it('adds a new rating and persists it', () => {
            const all = setRating('recipe-1', 'Alice', 5);
            expect(all).toHaveLength(1);
            expect(all[0].rating).toBe(5);
            expect(all[0].recipeId).toBe('recipe-1');
            expect(all[0].userName).toBe('Alice');

            const stored = JSON.parse(localStorage.getItem(RATINGS_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
        });

        it('updates an existing rating from the same user for the same recipe', () => {
            setRating('recipe-1', 'Alice', 3);
            const all = setRating('recipe-1', 'Alice', 5);
            expect(all).toHaveLength(1);
            expect(all[0].rating).toBe(5);
        });

        it('allows different users to rate the same recipe independently', () => {
            setRating('recipe-1', 'Alice', 3);
            const all = setRating('recipe-1', 'Bob', 5);
            expect(all).toHaveLength(2);
        });

        it('clamps rating below 1 to 1', () => {
            const all = setRating('recipe-1', 'Alice', 0);
            expect(all[0].rating).toBe(1);
        });

        it('clamps rating above 5 to 5', () => {
            const all = setRating('recipe-1', 'Alice', 10);
            expect(all[0].rating).toBe(5);
        });

        it('accepts boundary value of 1', () => {
            const all = setRating('recipe-1', 'Alice', 1);
            expect(all[0].rating).toBe(1);
        });

        it('accepts boundary value of 5', () => {
            const all = setRating('recipe-1', 'Alice', 5);
            expect(all[0].rating).toBe(5);
        });

        it('stores a timestamp on each rating', () => {
            const all = setRating('recipe-1', 'Alice', 4);
            expect(all[0].timestamp).toBeTruthy();
            expect(typeof all[0].timestamp).toBe('string');
        });

        it('calls notifyPrefsChanged', async () => {
            const { notifyPrefsChanged } = await import('../services/userPrefsSync');
            setRating('recipe-1', 'Alice', 4);
            expect(notifyPrefsChanged).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('getUserRating', () => {
        it('returns 0 when the user has not rated the recipe', () => {
            expect(getUserRating('recipe-1', 'Alice')).toBe(0);
        });

        it('returns the stored rating for the user/recipe pair', () => {
            setRating('recipe-1', 'Alice', 4);
            expect(getUserRating('recipe-1', 'Alice')).toBe(4);
        });

        it('returns 0 for a different user who has not rated', () => {
            setRating('recipe-1', 'Alice', 5);
            expect(getUserRating('recipe-1', 'Bob')).toBe(0);
        });

        it('returns 0 for a different recipe even when user rated another', () => {
            setRating('recipe-2', 'Alice', 5);
            expect(getUserRating('recipe-1', 'Alice')).toBe(0);
        });

        it('reflects an updated rating after re-rating', () => {
            setRating('recipe-1', 'Alice', 3);
            setRating('recipe-1', 'Alice', 5);
            expect(getUserRating('recipe-1', 'Alice')).toBe(5);
        });
    });

    // -------------------------------------------------------------------------
    describe('isFamilyApproved', () => {
        it('returns false when there are no ratings', () => {
            expect(isFamilyApproved('recipe-1')).toBe(false);
        });

        it('returns false when fewer than 3 ratings are >= 4', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-1', 'Bob', 4);
            expect(isFamilyApproved('recipe-1')).toBe(false);
        });

        it('returns true when exactly 3 ratings are >= 4', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-1', 'Bob', 4);
            setRating('recipe-1', 'Carol', 4);
            expect(isFamilyApproved('recipe-1')).toBe(true);
        });

        it('returns true when more than 3 ratings are >= 4', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-1', 'Bob', 5);
            setRating('recipe-1', 'Carol', 4);
            setRating('recipe-1', 'Dave', 5);
            expect(isFamilyApproved('recipe-1')).toBe(true);
        });

        it('returns false when enough total ratings but fewer than 3 are >= 4', () => {
            setRating('recipe-1', 'Alice', 5);
            setRating('recipe-1', 'Bob', 3);
            setRating('recipe-1', 'Carol', 2);
            setRating('recipe-1', 'Dave', 1);
            expect(isFamilyApproved('recipe-1')).toBe(false);
        });

        it('treats a rating of exactly 4 as qualifying', () => {
            setRating('recipe-1', 'Alice', 4);
            setRating('recipe-1', 'Bob', 4);
            setRating('recipe-1', 'Carol', 4);
            expect(isFamilyApproved('recipe-1')).toBe(true);
        });

        it('does not count ratings for other recipes', () => {
            setRating('recipe-2', 'Alice', 5);
            setRating('recipe-2', 'Bob', 5);
            setRating('recipe-2', 'Carol', 5);
            expect(isFamilyApproved('recipe-1')).toBe(false);
        });
    });
});

// =============================================================================
describe('notes utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // -------------------------------------------------------------------------
    describe('getAllNotes', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getAllNotes()).toEqual([]);
        });

        it('parses and returns stored notes', () => {
            const notes = [
                { id: 'n1', recipeId: 'r1', userName: 'Alice', text: 'Delicious!', timestamp: new Date().toISOString() },
            ];
            localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
            const result = getAllNotes();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('n1');
        });

        it('returns an empty array for malformed JSON', () => {
            localStorage.setItem(NOTES_KEY, '{{invalid}}');
            expect(getAllNotes()).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getNotesForRecipe', () => {
        it('returns notes only for the given recipeId', () => {
            addNote('recipe-1', 'Alice', 'Great recipe!');
            addNote('recipe-2', 'Bob', 'Too spicy');
            addNote('recipe-1', 'Carol', 'Added more salt');

            const result = getNotesForRecipe('recipe-1');
            expect(result).toHaveLength(2);
            result.forEach((n) => expect(n.recipeId).toBe('recipe-1'));
        });

        it('returns an empty array when no notes exist for the recipe', () => {
            expect(getNotesForRecipe('nonexistent-recipe')).toEqual([]);
        });

        it('returns notes sorted newest first', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
            addNote('recipe-1', 'Alice', 'First note');
            vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
            addNote('recipe-1', 'Bob', 'Second note');
            vi.useRealTimers();

            const result = getNotesForRecipe('recipe-1');
            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('Second note');
            expect(result[1].text).toBe('First note');
        });
    });

    // -------------------------------------------------------------------------
    describe('addNote', () => {
        it('adds a note and persists it to localStorage', () => {
            const all = addNote('recipe-1', 'Alice', 'This is tasty!');
            expect(all).toHaveLength(1);
            expect(all[0].text).toBe('This is tasty!');
            expect(all[0].recipeId).toBe('recipe-1');
            expect(all[0].userName).toBe('Alice');

            const stored = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
        });

        it('trims whitespace from the note text', () => {
            const all = addNote('recipe-1', 'Alice', '  Trim this!  ');
            expect(all[0].text).toBe('Trim this!');
        });

        it('assigns a unique id to each note', () => {
            addNote('recipe-1', 'Alice', 'Note A');
            const all = addNote('recipe-1', 'Alice', 'Note B');
            expect(all[0].id).not.toBe(all[1].id);
        });

        it('appends without overwriting existing notes', () => {
            addNote('recipe-1', 'Alice', 'First');
            const all = addNote('recipe-1', 'Bob', 'Second');
            expect(all).toHaveLength(2);
        });

        it('stores a timestamp on each note', () => {
            const all = addNote('recipe-1', 'Alice', 'Hello');
            expect(all[0].timestamp).toBeTruthy();
            expect(typeof all[0].timestamp).toBe('string');
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteNote', () => {
        it('removes the note with the given id', () => {
            addNote('recipe-1', 'Alice', 'Keep me');
            const all = addNote('recipe-1', 'Bob', 'Delete me');
            const noteToDelete = all.find((n) => n.text === 'Delete me')!;

            const remaining = deleteNote(noteToDelete.id);
            expect(remaining).toHaveLength(1);
            expect(remaining[0].text).toBe('Keep me');
        });

        it('persists the deletion to localStorage', () => {
            const all = addNote('recipe-1', 'Alice', 'To delete');
            const noteId = all[0].id;
            deleteNote(noteId);
            const stored = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]');
            expect(stored.find((n: { id: string }) => n.id === noteId)).toBeUndefined();
        });

        it('leaves other notes intact', () => {
            addNote('recipe-1', 'Alice', 'A');
            addNote('recipe-1', 'Bob', 'B');
            const all = addNote('recipe-1', 'Carol', 'C');
            const bNote = all.find((n) => n.text === 'B')!;

            const remaining = deleteNote(bNote.id);
            expect(remaining).toHaveLength(2);
            expect(remaining.map((n) => n.text)).toContain('A');
            expect(remaining.map((n) => n.text)).toContain('C');
        });

        it('is a no-op when the id does not exist', () => {
            addNote('recipe-1', 'Alice', 'Stays');
            const remaining = deleteNote('nonexistent-id');
            expect(remaining).toHaveLength(1);
        });

        it('returns an empty array after deleting the only note', () => {
            const all = addNote('recipe-1', 'Alice', 'Only one');
            const remaining = deleteNote(all[0].id);
            expect(remaining).toEqual([]);
        });
    });
});
