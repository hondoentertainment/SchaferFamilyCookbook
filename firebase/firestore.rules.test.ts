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
});
