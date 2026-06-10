import { STORAGE_KEYS } from '../constants/storage';
import type { RecipeCollection } from '../types';
import { notifyPrefsChanged } from '../services/userPrefsSync';

const COLLECTION_ICONS = ['📚', '🍳', '🎄', '🌮', '🥘', '🍝', '🎂', '🥗', '🌶️', '🧁', '🍜', '🥧'];

export function getRandomCollectionIcon(): string {
  return COLLECTION_ICONS[Math.floor(Math.random() * COLLECTION_ICONS.length)];
}

export function getAllCollections(): RecipeCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.collections);
    if (!raw) return [];
    return JSON.parse(raw) as RecipeCollection[];
  } catch {
    return [];
  }
}

function persistCollections(all: RecipeCollection[]): void {
  localStorage.setItem(STORAGE_KEYS.collections, JSON.stringify(all));
  notifyPrefsChanged();
}

export function createCollection(
  name: string,
  createdBy: string,
  description?: string,
  icon?: string,
): RecipeCollection {
  const all = getAllCollections();
  const collection: RecipeCollection = {
    id: 'col' + Date.now() + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    description: description?.trim(),
    recipeIds: [],
    createdBy,
    icon: icon || getRandomCollectionIcon(),
    timestamp: new Date().toISOString(),
  };
  all.push(collection);
  persistCollections(all);
  return collection;
}

export function deleteCollection(id: string): RecipeCollection[] {
  const all = getAllCollections().filter((c) => c.id !== id);
  persistCollections(all);
  return all;
}

export function addToCollection(collectionId: string, recipeId: string): RecipeCollection[] {
  const all = getAllCollections();
  const col = all.find((c) => c.id === collectionId);
  if (col && !col.recipeIds.includes(recipeId)) {
    col.recipeIds.push(recipeId);
  }
  persistCollections(all);
  return all;
}

export function removeFromCollection(collectionId: string, recipeId: string): RecipeCollection[] {
  const all = getAllCollections();
  const col = all.find((c) => c.id === collectionId);
  if (col) {
    col.recipeIds = col.recipeIds.filter((id) => id !== recipeId);
  }
  persistCollections(all);
  return all;
}

export function getCollectionsForRecipe(recipeId: string): RecipeCollection[] {
  return getAllCollections().filter((c) => c.recipeIds.includes(recipeId));
}
