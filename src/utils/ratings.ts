import { STORAGE_KEYS } from '../constants/storage';
import { notifyPrefsChanged } from '../services/userPrefsSync';
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

export function getRatingsForRecipe(recipeId: string): RecipeRating[] {
  return getAllRatings().filter((r) => r.recipeId === recipeId);
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
  return entry?.rating ?? 0;
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

export function getNotesForRecipe(recipeId: string): RecipeNote[] {
  return getAllNotes()
    .filter((n) => n.recipeId === recipeId)
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
  return all;
}

export function deleteNote(noteId: string): RecipeNote[] {
  const all = getAllNotes().filter((n) => n.id !== noteId);
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(all));
  return all;
}
