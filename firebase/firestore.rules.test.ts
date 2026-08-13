import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8');

let env: RulesTestEnvironment;

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-schafer',
        firestore: {
            rules: RULES,
        },
    });
}, 120_000);

afterAll(async () => {
    await env.cleanup();
});

beforeEach(async () => {
    await env.clearFirestore();
});

describe('firestore.rules (emulator)', () => {
    it('anonymous can read arbitrary recipe path', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(getDoc(doc(anon, 'recipes/any')));
    });

    it('anonymous cannot create recipes', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'recipes/pwned'), {
                title: 'Not allowed',
            }),
        );
    });

    function adminFirestore() {
        return env
            .authenticatedContext('custodian1', {
                firebase: {
                    sign_in_provider: 'custom',
                },
                admin: true,
            })
            .firestore();
    }

    it('admin can upsert recipes', async () => {
        await assertSucceeds(setDoc(doc(adminFirestore(), 'recipes/new123'), { title: 'Soup' }));
    });

    it('anonymous can upsert constrained userPrefs', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: ['r1'],
                ratings: {},
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous can write userPrefs with favorites, ratings, collections shape', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: ['r1'],
                ratings: { r1: 5 },
                collections: [
                    {
                        id: 'col1',
                        name: 'Holiday',
                        recipeIds: ['r1'],
                        createdBy: 'scout',
                        icon: '🎄',
                        timestamp: '2026-01-01T00:00:00.000Z',
                    },
                ],
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous can write userPrefs with meal plan shape', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: [],
                ratings: {},
                collections: [],
                mealPlan: [
                    {
                        id: 'mp1',
                        date: '2026-06-21',
                        recipeId: 'r1',
                        addedAt: 1782000000000,
                    },
                ],
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous can write userPrefs with grocery list shape', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: [],
                ratings: {},
                collections: [],
                mealPlan: [],
                groceryList: [
                    {
                        id: 'g1',
                        text: '2 cups flour',
                        recipeId: 'r1',
                        recipeTitle: 'Bread',
                        checked: false,
                        addedAt: 1782000000000,
                    },
                ],
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous can write userPrefs with notes and displayName shape', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: [],
                ratings: { r1: 4 },
                displayName: 'Scout',
                notes: [
                    {
                        id: 'n1',
                        recipeId: 'r1',
                        userName: 'Scout',
                        text: 'Add extra butter — trust me.',
                        timestamp: '2026-07-01T00:00:00.000Z',
                    },
                ],
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous cannot write userPrefs with a non-string displayName', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                displayName: 42,
            }),
        );
    });

    it('anonymous cannot write userPrefs with an overlong displayName', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                displayName: 'x'.repeat(81),
            }),
        );
    });

    it('anonymous cannot write userPrefs with non-list notes', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                notes: { n1: 'not a list' },
            }),
        );
    });

    it('anonymous can write userPrefs with deletedNoteIds tombstones', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'userPrefs/scout'), {
                favorites: [],
                notes: [],
                deletedNoteIds: ['n1', 'n2'],
                updatedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous cannot write userPrefs with non-list deletedNoteIds', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                deletedNoteIds: 'n1',
            }),
        );
    });

    it('anonymous cannot write userPrefs with an oversized notes list', async () => {
        const anon = env.unauthenticatedContext().firestore();
        const notes = Array.from({ length: 501 }, (_, i) => ({
            id: `n${i}`,
            recipeId: 'r1',
            userName: 'Scout',
            text: 'x',
            timestamp: '2026-07-01T00:00:00.000Z',
        }));
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                notes,
            }),
        );
    });

    it('anonymous cannot add unexpected keys to userPrefs', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'userPrefs/bad'), {
                favorites: [],
                evil: true,
            }),
        );
    });

    it('anonymous can create valid trivia leaderboard row', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'triviaScores/le1'), {
                displayName: 'Ada',
                userId: 'u1',
                score: 2,
                total: 10,
                completedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous cannot create trivia row with impossible score/total ratio', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'triviaScores/bogus'), {
                displayName: 'Bob',
                userId: 'u2',
                score: 20,
                total: 10,
                completedAt: serverTimestamp(),
            }),
        );
    });

    it('anonymous can append analytics events but cannot read them', async () => {
        const anon = env.unauthenticatedContext().firestore();
        const ref = doc(anon, 'analytics_events/e_smoke');
        await assertSucceeds(setDoc(ref, { recipeId: 'x', ts: Date.now() }));
        await assertFails(getDoc(ref));
    });

    it('recipe_versions subtree: anonymous read allowed, anonymous write denied', async () => {
        const anon = env.unauthenticatedContext().firestore();
        const leaf = doc(anon, 'recipe_versions', 'rec1', 'versions', 'ver1');
        await assertFails(
            setDoc(leaf, {
                savedAt: serverTimestamp(),
                savedBy: 'Somebody',
                title: 'T',
            }),
        );
        const snap = await getDoc(leaf);
        expect(snap.exists()).toBe(false);
    });

    it('recipe_versions subtree: admin can write', async () => {
        const db = adminFirestore();
        await assertSucceeds(
            setDoc(doc(db, 'recipe_versions', 'rec2', 'versions', 'ver2'), {
                savedAt: serverTimestamp(),
                savedBy: 'Kyle',
            }),
        );
    });

    it('fcm_tokens unreadable anonymously', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(anon, 'fcm_tokens/some')));
    });

    it('fcm_tokens create allowed with token + userName', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'fcm_tokens/tk1'), {
                token: 'device-token-sample',
                userName: 'Alice',
            }),
        );
    });

    it('anonymous cannot create gallery items with invalid shape', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'gallery/g1'), {
                id: 'g1',
                type: 'image',
                url: 'http://insecure.example/photo.jpg',
                caption: 'Hi',
                contributor: 'Ada',
                created_at: '2026-06-26T00:00:00.000Z',
                status: 'pending',
            }),
        );
    });

    it('anonymous can create valid gallery item', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertSucceeds(
            setDoc(doc(anon, 'gallery/g2'), {
                id: 'g2',
                type: 'image',
                url: 'https://storage.googleapis.com/demo-bucket/gallery/photo.jpg',
                caption: 'Summer BBQ',
                contributor: 'Ada',
                created_at: '2026-06-26T00:00:00.000Z',
                status: 'pending',
            }),
        );
    });

    it('anonymous cannot create gallery item without pending status', async () => {
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'gallery/g-approved'), {
                id: 'g-approved',
                type: 'image',
                url: 'https://storage.googleapis.com/demo-bucket/gallery/photo.jpg',
                caption: 'Skip queue',
                contributor: 'Ada',
                created_at: '2026-06-26T00:00:00.000Z',
                status: 'approved',
            }),
        );
    });

    it('anonymous cannot update or delete gallery items', async () => {
        const db = adminFirestore();
        await assertSucceeds(
            setDoc(doc(db, 'gallery/g3'), {
                id: 'g3',
                type: 'image',
                url: 'https://storage.googleapis.com/demo-bucket/gallery/photo.jpg',
                caption: 'Original',
                contributor: 'Kyle',
                created_at: '2026-06-26T00:00:00.000Z',
            }),
        );
        const anon = env.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(anon, 'gallery/g3'), {
                id: 'g3',
                type: 'image',
                url: 'https://storage.googleapis.com/demo-bucket/gallery/photo.jpg',
                caption: 'Hacked',
                contributor: 'Ada',
                created_at: '2026-06-26T00:00:00.000Z',
            }),
        );
    });
});
