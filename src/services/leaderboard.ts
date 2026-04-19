import {
    addDoc,
    collection,
    getDocs,
    limit as firestoreLimit,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { CloudArchive } from './db';
import { ensureAnonUser } from './anonAuth';

export interface LeaderboardEntry {
    id: string;
    userId: string;
    displayName: string;
    avatarKey?: string;
    score: number;
    total: number;
    percentage: number;
    /** ISO timestamp from server clock (best-effort). */
    completedAt: string;
}

export interface SubmitScoreInput {
    userId: string;
    displayName: string;
    avatarKey?: string;
    score: number;
    total: number;
    /** Optional client-known completion timestamp; server timestamp always wins. */
    completedAt?: Date | string;
}

const COLLECTION = 'triviaScores';

/**
 * Throws if Firebase isn't configured. Keep local scoreboard as a fallback.
 */
function requireFirestore() {
    const fb = CloudArchive.getFirebase();
    if (!fb) {
        throw new Error('Leaderboard unavailable: Firebase is not configured.');
    }
    return fb.db;
}

/**
 * Convert a Firestore Timestamp (or server-sent value) to an ISO string.
 * Falls back to "now" if the server stamp hasn't resolved yet.
 */
function toIsoString(value: unknown): string {
    if (!value) return new Date().toISOString();
    if (value instanceof Timestamp) return value.toDate().toISOString();
    // Raw plain object shape {seconds, nanoseconds}
    if (typeof value === 'object' && value !== null) {
        const v = value as { seconds?: number; nanoseconds?: number; toDate?: () => Date };
        if (typeof v.toDate === 'function') return v.toDate().toISOString();
        if (typeof v.seconds === 'number') {
            const ms = v.seconds * 1000 + Math.floor((v.nanoseconds ?? 0) / 1e6);
            return new Date(ms).toISOString();
        }
    }
    if (typeof value === 'string') return value;
    return new Date().toISOString();
}

export async function submitScore(input: SubmitScoreInput): Promise<void> {
    const db = requireFirestore();

    const displayName = input.displayName?.trim();
    if (!displayName) throw new Error('submitScore: displayName is required');
    if (typeof input.score !== 'number' || typeof input.total !== 'number') {
        throw new Error('submitScore: score and total must be numbers');
    }
    if (input.total <= 0) throw new Error('submitScore: total must be positive');
    if (input.score < 0 || input.score > input.total) {
        throw new Error('submitScore: score must be between 0 and total');
    }

    // Firestore rules require request.auth.uid == request.resource.data.userId,
    // so we fully override the caller-supplied userId with the anonymous auth
    // uid. The caller's local user id stays in their own scoreboard entry.
    const user = await ensureAnonUser();
    if (!user) {
        throw new Error('Leaderboard unavailable: anonymous auth failed.');
    }

    const payload: Record<string, unknown> = {
        userId: user.uid,
        displayName,
        score: input.score,
        total: input.total,
        percentage: Math.round((input.score / input.total) * 100),
        // Rules enforce completedAt === request.time; always use server timestamp.
        completedAt: serverTimestamp(),
    };
    if (input.avatarKey) payload.avatarKey = input.avatarKey;

    await addDoc(collection(db, COLLECTION), payload);
}

/**
 * Fetch the top N scores. Ordering: score DESC, completedAt ASC (ties → earliest wins).
 */
export async function getTopScores(max = 10): Promise<LeaderboardEntry[]> {
    const db = requireFirestore();

    const q = query(
        collection(db, COLLECTION),
        orderBy('score', 'desc'),
        orderBy('completedAt', 'asc'),
        firestoreLimit(max)
    );

    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const score = typeof data.score === 'number' ? data.score : 0;
        const total = typeof data.total === 'number' && data.total > 0 ? data.total : 1;
        return {
            id: doc.id,
            userId: typeof data.userId === 'string' ? data.userId : 'anonymous',
            displayName: typeof data.displayName === 'string' ? data.displayName : 'Anonymous',
            avatarKey: typeof data.avatarKey === 'string' ? data.avatarKey : undefined,
            score,
            total,
            percentage:
                typeof data.percentage === 'number'
                    ? data.percentage
                    : Math.round((score / total) * 100),
            completedAt: toIsoString(data.completedAt),
        } satisfies LeaderboardEntry;
    });
}

export function isLeaderboardAvailable(): boolean {
    return CloudArchive.getFirebase() !== null;
}
