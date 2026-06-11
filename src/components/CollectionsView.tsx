import React, { useState } from 'react';
import {
  getAllCollections,
  createCollection,
  deleteCollection,
  removeFromCollection,
} from '../utils/collections';
import { hapticLight } from '../utils/haptics';
import type { Recipe, RecipeCollection } from '../types';

interface CollectionsViewProps {
  recipes: Recipe[];
  currentUserName: string;
  onViewRecipe: (recipe: Recipe) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  recipes,
  currentUserName,
  onViewRecipe,
}) => {
  const [collections, setCollections] = useState<RecipeCollection[]>(() => getAllCollections());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    hapticLight();
    createCollection(newName, currentUserName, newDesc);
    setCollections(getAllCollections());
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    hapticLight();
    deleteCollection(id);
    setCollections(getAllCollections());
  };

  const handleRemoveRecipe = (collectionId: string, recipeId: string) => {
    hapticLight();
    removeFromCollection(collectionId, recipeId);
    setCollections(getAllCollections());
  };

  return (
    <section className="space-y-6" aria-label="Recipe collections">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">
          Collections ({collections.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brand)] dark:text-emerald-400 hover:underline"
        >
          {showCreate ? 'Cancel' : '+ New Collection'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-stone-50 dark:bg-[var(--bg-tertiary)] rounded-2xl p-4 border border-stone-200 dark:border-[var(--border-color)] space-y-3 animate-fade-slide-in">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collection name (e.g. Holiday Baking)"
            className="w-full px-4 py-3 bg-white dark:bg-[var(--input-bg)] border border-stone-200 dark:border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-4 py-3 bg-white dark:bg-[var(--input-bg)] border border-stone-200 dark:border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-5 py-3 bg-[var(--color-brand)] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#1e2f23] transition-colors disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {collections.length === 0 && !showCreate ? (
        <div className="text-center py-8 space-y-3">
          <span className="text-4xl">📚</span>
          <p className="text-sm text-stone-500 font-serif italic">
            Organize recipes into custom collections like "Holiday Baking" or "Weeknight Dinners"
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-5 py-3 bg-[var(--color-brand)] text-white rounded-full text-[10px] font-black uppercase tracking-widest"
          >
            Create Your First Collection
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((col) => {
            const colRecipes = col.recipeIds
              .map((id) => recipes.find((r) => r.id === id))
              .filter((r): r is Recipe => !!r);
            const isExpanded = expandedId === col.id;

            return (
              <div
                key={col.id}
                className="bg-white dark:bg-[var(--card-bg)] rounded-2xl border border-stone-100 dark:border-[var(--border-color)] overflow-hidden card-hover-lift"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : col.id)}
                  className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="text-2xl">{col.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-stone-800 dark:text-stone-200 truncate">{col.name}</p>
                    {col.description && (
                      <p className="text-xs text-stone-500 truncate">{col.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 tabular-nums">{colRecipes.length} recipes</span>
                  <span className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-stone-100 dark:border-[var(--border-color)] animate-fade-slide-in">
                    {colRecipes.length === 0 ? (
                      <p className="py-4 text-sm text-stone-400 text-center font-serif italic">
                        No recipes yet. Add recipes from the recipe detail view.
                      </p>
                    ) : (
                      colRecipes.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 py-2">
                          <button
                            type="button"
                            onClick={() => onViewRecipe(r)}
                            className="flex-1 text-left text-sm font-serif italic text-stone-700 dark:text-stone-300 hover:text-[var(--color-brand)] dark:hover:text-emerald-400 truncate"
                          >
                            {r.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipe(col.id, r.id)}
                            className="text-stone-300 hover:text-red-500 text-xs min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                            aria-label={`Remove ${r.title} from ${col.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(col.id)}
                        className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600"
                      >
                        Delete Collection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
