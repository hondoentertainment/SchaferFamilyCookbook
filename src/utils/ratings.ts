import { STORAGE_KEYS } from '../constants/storage';
import { notifyPrefsChanged, deriveUserId } from '../services/userPrefsSync';
import { getFamilyPrefsCache, displayNameFromSlug } from './familyPrefsCache';
import type { RecipeRating, RecipeNote } from '../types';

// --- Ratings ---

export function getAllRatings(): RecipeRating[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ratings);
    if (!raw) return [];
    return JSON.parse(raw) as RecipeRating[];
  } catch {
    return [];
  }
}

/**
 * All known ratings for a recipe: the cached family-wide aggregate (one entry
 * per family member, fetched from Firestore) merged with local device ratings.
 * Deduped by user slug; the local entry wins because it is always at least as
 * fresh for users who rate on this device.
 */
export function getRatingsForRecipe(recipeId: string): RecipeRating[] {
  const byUser = new Map<string, RecipeRating>();
  const cache = getFamilyPrefsCache();
  if (cache) {
    for (const member of cache.members) {
      const rating = member.ratings[recipeId];
      if (typeof rating === 'number' && Number.isFinite(rating)) {
        byUser.set(member.userId, {
          recipeId,
          userName: member.displayName || displayNameFromSlug(member.userId),
          rating: Math.max(1, Math.min(5, rating)),
          timestamp: cache.fetchedAt,
        });
      }
    }
  }
  for (const r of getAllRatings()) {
    if (r.recipeId !== recipeId) continue;
    byUser.set(deriveUserId(r.userName) ?? r.userName, r);
  }
  return [...byUser.values()];
}

export function getAverageRating(recipeId: string): number {
  const ratings = getRatingsForRecipe(recipeId);
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}

export function getRatingCount(recipeId: string): number {
  return getRatingsForRecipe(recipeId).length;
}

export function setRating(recipeId: string, userName: string, rating: number): RecipeRating[] {
  const all = getAllRatings();
  const existing = all.findIndex((r) => r.recipeId === recipeId && r.userName === userName);
  const entry: RecipeRating = {
    recipeId,
    userName,
    rating: Math.max(1, Math.min(5, rating)),
    timestamp: new Date().toISOString(),
  };
  if (existing >= 0) {
    all[existing] = entry;
  } else {
    all.push(entry);
  }
  localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(all));
  notifyPrefsChanged();
  return all;
}

export function getUserRating(recipeId: string, userName: string): number {
  const all = getAllRatings();
  const entry = all.find((r) => r.recipeId === recipeId && r.userName === userName);
  if (entry) return entry.rating;
  // Fall back to the family cache: on a fresh device the user's own rating
  // may only exist in the synced aggregate until hydration completes.
  const slug = deriveUserId(userName);
  if (!slug) return 0;
  const member = getFamilyPrefsCache()?.members.find((m) => m.userId === slug);
  const cached = member?.ratings[recipeId];
  return typeof cached === 'number' && Number.isFinite(cached)
    ? Math.max(1, Math.min(5, cached))
    : 0;
}

export function isFamilyApproved(recipeId: string): boolean {
  const ratings = getRatingsForRecipe(recipeId);
  const highRatings = ratings.filter((r) => r.rating >= 4);
  return highRatings.length >= 3;
}

// --- Notes ---

export function getAllNotes(): RecipeNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.notes);
    if (!raw) return [];
    return JSON.parse(raw) as RecipeNote[];
  } catch {
    return [];
  }
}

/**
 * All known notes for a recipe: the cached family aggregate merged with local
 * notes, deduped by note id (local wins). Pass `currentUserName` so the
 * current user's notes come only from local state — otherwise a note they
 * just deleted would reappear from the stale family cache.
 */
export function getNotesForRecipe(recipeId: string, currentUserName?: string): RecipeNote[] {
  const currentSlug = deriveUserId(currentUserName);
  const byId = new Map<string, RecipeNote>();
  const cache = getFamilyPrefsCache();
  if (cache) {
    for (const member of cache.members) {
      if (currentSlug && member.userId === currentSlug) continue;
      for (const note of member.notes) {
        if (note.recipeId === recipeId) byId.set(note.id, note);
      }
    }
  }
  for (const n of getAllNotes()) {
    if (n.recipeId === recipeId) byId.set(n.id, n);
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addNote(recipeId: string, userName: string, text: string): RecipeNote[] {
  const all = getAllNotes();
  const note: RecipeNote = {
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
    recipeId,
    userName,
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };
  all.push(note);
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(all));
  notifyPrefsChanged();
  return all;
}

export function deleteNote(noteId: string): RecipeNote[] {
  const all = getAllNotes().filter((n) => n.id !== noteId);
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(all));
  recordDeletedNoteIds([noteId]);
  notifyPrefsChanged();
  return all;
}

// --- Deleted-note tombstones ---
// Deletions must survive cross-device merges: without a tombstone, a stale
// copy of the note on another device would resurrect it on the next sync.

export function getDeletedNoteIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.deletedNotes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [];
  } catch {
    return [];
  }
}

/** Append tombstones (deduped, newest kept when the cap is exceeded). */
export function recordDeletedNoteIds(ids: string[]): void {
  const merged = [...new Set([...getDeletedNoteIds(), ...ids])].slice(-500);
  localStorage.setItem(STORAGE_KEYS.deletedNotes, JSON.stringify(merged));
}
