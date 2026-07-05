import React from 'react';
import { avatarOnError } from '../utils/avatarFallback';
import { getAverageRating } from '../utils/ratings';
import type { Recipe, ContributorProfile } from '../types';

interface ContributorSpotlightProps {
  contributor: ContributorProfile;
  recipes: Recipe[];
  onViewRecipe: (recipe: Recipe) => void;
  onClose: () => void;
}

export const ContributorSpotlight: React.FC<ContributorSpotlightProps> = ({
  contributor,
  recipes,
  onViewRecipe,
  onClose,
}) => {
  const contributorRecipes = recipes.filter(
    (r) => r.contributor.toLowerCase() === contributor.name.toLowerCase(),
  );

  const categories = Array.from(new Set(contributorRecipes.map((r) => r.category)));
  const topRated = [...contributorRecipes]
    .map((r) => ({ recipe: r, avg: getAverageRating(r.id) }))
    .filter((r) => r.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={`${contributor.name}'s recipe spotlight`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        aria-label="Close contributor spotlight"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-[var(--card-bg)] rounded-[3rem] p-8 md:p-12 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 w-11 h-11 rounded-full bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Profile Header */}
        <div className="text-center space-y-4 mb-8">
          <img
            src={contributor.avatar}
            alt={contributor.name}
            decoding="async"
            onError={avatarOnError}
            className="w-28 h-28 rounded-full mx-auto border-4 border-white dark:border-stone-700 shadow-xl object-cover"
          />
          <h2 className="text-3xl font-serif italic text-[var(--color-brand)] dark:text-emerald-400">
            {contributor.name}
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 bg-[var(--color-brand)]/10 dark:bg-emerald-900/30 text-[var(--color-brand)] dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
              {contributorRecipes.length} recipes
            </span>
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 rounded-full text-[10px] font-black uppercase tracking-widest"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Top Rated */}
        {topRated.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">
              Highest Rated
            </h3>
            <div className="space-y-2">
              {topRated.map(({ recipe, avg }) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onViewRecipe(recipe)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[var(--bg-tertiary)] hover:bg-stone-100 dark:hover:bg-stone-600 transition-colors text-left"
                >
                  <span className="text-amber-400 text-lg">★</span>
                  <span className="flex-1 font-serif italic text-sm text-stone-700 dark:text-stone-300 truncate">
                    {recipe.title}
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{avg.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* All Recipes */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">
            All Recipes
          </h3>
          {contributorRecipes.length === 0 ? (
            <p className="text-sm text-stone-400 font-serif italic text-center py-4">
              No recipes from this contributor yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {contributorRecipes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onViewRecipe(r)}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-[var(--bg-tertiary)] hover:bg-stone-100 dark:hover:bg-stone-600 transition-colors text-left space-y-1"
                >
                  <p className="font-serif italic text-sm text-stone-700 dark:text-stone-300 truncate">
                    {r.title}
                  </p>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest">{r.category}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
