import { collection, getDocs } from 'firebase/firestore';
import { CloudArchive } from './db';
import { parseNotes, parseDeletedNoteIds } from './userPrefsSync';
import { Sentry } from '../monitoring/sentry';
import {
    setFamilyPrefsCache,
    type FamilyMemberPrefs,
} from '../utils/familyPrefsCache';

/**
 * Fetch every family member's `userPrefs` doc (world-readable by design) and
 * cache the aggregate locally so ratings/notes readers can show family-wide
 * data. Fire-and-forget: returns false when Firebase isn't configured or the
 * fetch fails; local data keeps working either way.
 */
export async function refreshFamilyPrefs(): Promise<boolean> {
    let db;
    try {
        const fb = CloudArchive.getFirebase();
        if (!fb || CloudArchive.getProvider() !== 'firebase') return false;
        db = fb.db;
    } catch {
        return false;
    }
    try {
        const snap = await getDocs(collection(db, 'userPrefs'));
        const members: FamilyMemberPrefs[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const ratingsIn =
                data.ratings && typeof data.ratings === 'object'
                    ? (data.ratings as Record<string, unknown>)
                    : {};
            const ratings: Record<string, number> = {};
            for (const [recipeId, value] of Object.entries(ratingsIn)) {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    ratings[recipeId] = Math.max(1, Math.min(5, value));
                }
            }
            // Respect the member's own tombstones in case a stale device
            // re-uploaded a deleted note.
            const deletedIds = new Set(parseDeletedNoteIds(data.deletedNoteIds));
            return {
                userId: d.id,
                displayName:
                    typeof data.displayName === 'string' && data.displayName.trim()
                        ? data.displayName.trim()
                        : undefined,
                ratings,
                notes: parseNotes(data.notes).filter((n) => !deletedIds.has(n.id)),
            };
        });
        setFamilyPrefsCache({ fetchedAt: new Date().toISOString(), members });
        return true;
    } catch (err) {
        try {
            Sentry.captureException(err, { tags: { scope: 'familyPrefs.refresh' } });
        } catch {
            // Sentry not initialized — fine.
        }
        return false;
    }
}
