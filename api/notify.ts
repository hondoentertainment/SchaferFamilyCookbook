import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { getClientIp, NOTIFY_PUSH_RATE_LIMIT, slidingWindowAllow } from './lib/rateLimit.js';
import { contributorNameMatches, normalizeContributorKey } from './lib/contributorAliases.js';

// Initialize Firebase Admin SDK once
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
        // GOOGLE_APPLICATION_CREDENTIALS points to a credentials file on disk
        admin.initializeApp();
    }
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err ?? '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Verify admin secret
    const notifySecret = process.env.NOTIFY_SECRET;
    const callerSecret = req.headers['x-notify-secret'];
    if (!notifySecret || callerSecret !== notifySecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notifyIp = getClientIp(req);
    if (
        !slidingWindowAllow(
            `notify:${notifyIp}`,
            NOTIFY_PUSH_RATE_LIMIT.max,
            NOTIFY_PUSH_RATE_LIMIT.windowMs,
        )
    ) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    // 2. Validate request body
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const bodyText = typeof body.body === 'string' ? body.body.trim() : undefined;
    const userNamesRaw = body.userNames;
    const userNameKeys = new Set<string>();
    if (typeof body.userName === 'string' && body.userName.trim()) {
        userNameKeys.add(normalizeContributorKey(body.userName));
    }
    if (Array.isArray(userNamesRaw)) {
        for (const name of userNamesRaw) {
            if (typeof name === 'string' && name.trim()) {
                userNameKeys.add(normalizeContributorKey(name));
            }
        }
    }

    if (!title) {
        return res.status(400).json({ error: 'Missing required field: title' });
    }

    // 3. Ensure Firebase Admin is ready
    if (!admin.apps.length) {
        return res.status(500).json({ error: 'Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.' });
    }

    try {
        const db = admin.firestore();

        // 4. Load all FCM tokens from Firestore
        const snapshot = await db.collection('fcm_tokens').get();
        const tokens: string[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (typeof data.token !== 'string' || !data.token.trim()) return;
            if (userNameKeys.size > 0) {
                const tokenUser = typeof data.userName === 'string' ? data.userName : '';
                if (!contributorNameMatches(tokenUser, userNameKeys)) return;
            }
            tokens.push(data.token.trim());
        });

        if (tokens.length === 0) {
            return res.status(200).json({ sent: 0, failed: 0 });
        }

        // 5. Fan out via FCM multicast
        const message: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title,
                ...(bodyText ? { body: bodyText } : {}),
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        const sent = response.successCount;
        const failed = response.failureCount;

        // Log individual failures for debugging without leaking tokens to the client
        response.responses.forEach((r, i) => {
            if (!r.success) {
                console.warn(`FCM send failed for token index ${i}:`, r.error?.message);
            }
        });

        return res.status(200).json({ sent, failed });
    } catch (err: unknown) {
        console.error('notify handler error:', err);
        return res.status(500).json({ error: getErrorMessage(err) || 'Internal server error' });
    }
}
