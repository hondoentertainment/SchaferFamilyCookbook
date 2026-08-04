import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { recipeOfTheWeek, isoWeekKey } from './lib/recipeOfTheWeek.js';
import { loadRecipesSeed, type RecipeSeedLike } from './loadRecipesSeed.js';

// Initialize Firebase Admin SDK once (same pattern as api/notify.ts)
if (!admin.apps.length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawServiceAccount) {
        try {
            const serviceAccount = JSON.parse(rawServiceAccount);
            if (serviceAccount.project_id) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
            }
        } catch (error) {
            console.error('Invalid FIREBASE_SERVICE_ACCOUNT JSON; Firebase Admin not initialized.', error);
        }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
    }
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err ?? '');
}

/** FCM multicast is capped at 500 tokens per call. */
const MULTICAST_CHUNK = 500;

function isAuthorized(req: VercelRequest): boolean {
    // Vercel Cron invokes with `Authorization: Bearer $CRON_SECRET`.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
    // Manual/ops invocation with the same shared secret /api/notify uses.
    const notifySecret = process.env.NOTIFY_SECRET;
    if (notifySecret && req.headers['x-notify-secret'] === notifySecret) return true;
    return false;
}

/** Live Firestore recipes when Admin is configured; bundled seed otherwise. */
async function loadRecipes(): Promise<{ recipes: RecipeSeedLike[]; source: 'firestore' | 'seed' }> {
    if (admin.apps.length) {
        try {
            const snapshot = await admin.firestore().collection('recipes').get();
            const recipes: RecipeSeedLike[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const id = typeof data.id === 'string' && data.id ? data.id : docSnap.id;
                if (typeof data.title !== 'string' || !data.title.trim()) return;
                recipes.push({
                    id,
                    title: data.title,
                    contributor: typeof data.contributor === 'string' ? data.contributor : '',
                });
            });
            if (recipes.length > 0) return { recipes, source: 'firestore' };
        } catch (err) {
            console.warn('recipe-of-the-week: Firestore read failed, falling back to seed:', getErrorMessage(err));
        }
    }
    return { recipes: loadRecipesSeed(), source: 'seed' };
}

/**
 * Weekly Recipe of the Week push. Invoked by Vercel Cron (see vercel.json)
 * every Sunday; picks the same deterministic recipe HomeView features that
 * week and fans it out to every registered FCM token.
 *
 * Query params:
 *   dryRun=1        — compute and return the pick without sending anything
 *   date=YYYY-MM-DD — override "today" (preview a future/past week's pick)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    let date = new Date();
    if (typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
        const [y, m, d] = req.query.date.split('-').map(Number);
        date = new Date(y, m - 1, d);
    }

    try {
        const { recipes, source } = await loadRecipes();
        const pick = recipeOfTheWeek(recipes, date);
        if (!pick) {
            return res.status(200).json({ sent: 0, failed: 0, week: isoWeekKey(date), recipe: null });
        }

        const week = isoWeekKey(date);
        const summary = {
            week,
            source,
            recipe: { id: pick.id, title: pick.title, contributor: pick.contributor },
        };

        if (dryRun) {
            return res.status(200).json({ ...summary, dryRun: true, sent: 0, failed: 0 });
        }

        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.' });
        }

        const snapshot = await admin.firestore().collection('fcm_tokens').get();
        const tokens: string[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (typeof data.token === 'string' && data.token.trim()) {
                tokens.push(data.token.trim());
            }
        });

        if (tokens.length === 0) {
            return res.status(200).json({ ...summary, sent: 0, failed: 0 });
        }

        const notification = {
            title: 'Recipe of the Week 🍲',
            body: pick.contributor
                ? `${pick.title} — from ${pick.contributor}`
                : pick.title,
        };

        let sent = 0;
        let failed = 0;
        for (let i = 0; i < tokens.length; i += MULTICAST_CHUNK) {
            const chunk = tokens.slice(i, i + MULTICAST_CHUNK);
            const response = await admin.messaging().sendEachForMulticast({
                tokens: chunk,
                notification,
                data: {
                    recipeId: pick.id,
                    url: `/share/recipe/${pick.id}`,
                    week,
                },
            });
            sent += response.successCount;
            failed += response.failureCount;
            response.responses.forEach((r, idx) => {
                if (!r.success) {
                    console.warn(`FCM send failed for token index ${i + idx}:`, r.error?.message);
                }
            });
        }

        return res.status(200).json({ ...summary, sent, failed });
    } catch (err: unknown) {
        console.error('recipe-of-the-week handler error:', err);
        return res.status(500).json({ error: getErrorMessage(err) || 'Internal server error' });
    }
}
