import React, { useEffect, useMemo, useState } from 'react';
import type { Recipe } from '../types';
import { useUI } from '../context/UIContext';
import { hapticLight } from '../utils/haptics';
import { PageHeader } from './PageHeader';
import {
  addDays,
  addToMealPlan,
  copyDay,
  copyWeek,
  getEntriesForDate,
  getEntriesInRange,
  getMealPlan,
  getWeekDates,
  getWeekStart,
  removeFromMealPlan,
  toDateKey,
  type MealPlanEntry,
} from '../utils/mealPlan';
import { addItems as addGroceryItems, getItems as getGroceryItems } from '../utils/groceryList';
import { fuzzyMatchAny } from '../utils/fuzzySearch';

interface MealPlanViewProps {
  recipes: Recipe[];
  onViewRecipe: (recipe: Recipe) => void;
  onBrowseRecipes: () => void;
  onOpenGroceryList: () => void;
  syncVersion?: number;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  recipes,
  onViewRecipe,
  onBrowseRecipes,
  onOpenGroceryList,
  syncVersion = 0,
}) => {
  const { toast } = useUI();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>(() => getMealPlan());
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const todayKey = toDateKey(new Date());
  const [expandedDay, setExpandedDay] = useState<string>(() => todayKey);

  const refresh = () => setEntries(getMealPlan());

  useEffect(() => {
    setEntries(getMealPlan());
  }, [syncVersion]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekKeys = useMemo(() => weekDates.map(toDateKey), [weekDates]);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  // `entries` is read so the memo recomputes after every plan mutation.
  const entriesByDate = useMemo(() => {
    void entries;
    const map = new Map<string, MealPlanEntry[]>();
    for (const key of weekKeys) map.set(key, getEntriesForDate(key));
    return map;
  }, [entries, weekKeys]);

  const weekRecipeCount = weekKeys.reduce((sum, key) => sum + (entriesByDate.get(key)?.length ?? 0), 0);

  const weekLabel = `${weekDates[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDates[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const shiftWeek = (deltaDays: number) => {
    hapticLight();
    setPickerDate(null);
    setWeekStart((prev) => addDays(prev, deltaDays));
    const nextWeek = getWeekDates(addDays(weekStart, deltaDays)).map(toDateKey);
    setExpandedDay(nextWeek.includes(todayKey) ? todayKey : nextWeek[0]);
  };

  const handleAdd = (dateKey: string, recipeId: string) => {
    hapticLight();
    addToMealPlan(dateKey, recipeId);
    refresh();
    setPickerDate(null);
    setQuery('');
  };

  const handleRemove = (entryId: string) => {
    hapticLight();
    removeFromMealPlan(entryId);
    refresh();
  };

  const handleGenerateGroceries = () => {
    const weekEntries = getEntriesInRange(weekKeys[0], weekKeys[6]);
    const rows = weekEntries.flatMap((entry) => {
      const recipe = recipeById.get(entry.recipeId);
      if (!recipe) return [];
      return recipe.ingredients
        .filter((ing) => ing.trim().length > 0)
        .map((ing) => ({ text: ing, recipeId: recipe.id, recipeTitle: recipe.title }));
    });
    if (rows.length === 0) {
      toast('Add recipes to this week before building a grocery list', 'info');
      return;
    }
    hapticLight();
    const prevCount = getGroceryItems().length;
    const next = addGroceryItems(rows);
    const added = Math.max(0, next.length - prevCount);
    const skipped = Math.max(0, rows.length - added);
    if (added === 0) {
      toast('Those ingredients are already on your Grocery List', 'info');
    } else {
      const skippedNote = skipped > 0 ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : '';
      toast(`Added ${added} item${added === 1 ? '' : 's'} to Grocery List${skippedNote}`, 'success', {
        action: { label: 'View list', onClick: onOpenGroceryList },
      });
    }
  };

  const handleCopyWeek = () => {
    if (weekRecipeCount === 0) {
      toast('Add recipes to this week before copying it forward', 'info');
      return;
    }
    hapticLight();
    const nextWeekKeys = getWeekDates(addDays(weekStart, 7)).map(toDateKey);
    const added = copyWeek(weekKeys, nextWeekKeys);
    refresh();
    if (added === 0) {
      toast('Next week already has these recipes', 'info');
    } else {
      toast(`Copied ${added} recipe${added === 1 ? '' : 's'} to next week`, 'success', {
        action: { label: 'Go to next week', onClick: () => shiftWeek(7) },
      });
    }
  };

  const handleCopyDayForward = (dateKey: string, i: number) => {
    hapticLight();
    const targetKey = i < 6 ? weekKeys[i + 1] : toDateKey(addDays(weekDates[6], 1));
    const added = copyDay(dateKey, targetKey);
    refresh();
    setExpandedDay(targetKey);
    if (added === 0) {
      toast('The next day already has these recipes', 'info');
    } else {
      toast(`Copied ${added} recipe${added === 1 ? '' : 's'} to the next day`, 'success');
    }
  };

  const pickerResults = useMemo(() => {
    const q = query.trim();
    const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return sorted.slice(0, 60);
    // Match across title, contributor, and ingredients with typo tolerance.
    return sorted
      .filter((r) => fuzzyMatchAny([r.title, r.contributor, r.ingredients.join(' ')], q))
      .slice(0, 60);
  }, [recipes, query]);

  return (
    <section
      data-testid="meal-plan-view"
      className="view-shell view-stack"
      aria-labelledby="meal-plan-heading"
    >
      <PageHeader
        id="meal-plan-heading"
        eyebrow="Cook · Plan · Shop"
        title="Meal plan"
        description="Plan recipes across the week, then turn the whole week into a grocery list."
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftWeek(-7)}
          className="min-h-11 min-w-11 rounded-full border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-stone-700 dark:text-stone-200">{weekLabel}</p>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setPickerDate(null);
              setWeekStart(getWeekStart(new Date()));
              setExpandedDay(todayKey);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-[#2D4635] dark:text-emerald-400 hover:underline"
          >
            This week
          </button>
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(7)}
          className="min-h-11 min-w-11 rounded-full border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {weekRecipeCount === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 bg-white/60 dark:bg-stone-900/40 p-5 text-center space-y-3">
          <span className="text-3xl" aria-hidden="true">
            🗓️
          </span>
          <p className="text-sm text-stone-500 dark:text-stone-400 font-serif italic">
            No recipes planned for this week yet. Use “+ Add recipe” on any day, or open a recipe and choose
            “Add to meal plan”.
          </p>
          <button
            type="button"
            onClick={onBrowseRecipes}
            className="min-h-11 px-5 py-2.5 rounded-full bg-[#2D4635] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1e2f23] transition-colors"
          >
            Browse recipes
          </button>
        </div>
      )}

      <div className="space-y-2">
        {weekDates.map((date, i) => {
          const dateKey = weekKeys[i];
          const dayEntries = entriesByDate.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          const pickerOpen = pickerDate === dateKey;
          const isExpanded = expandedDay === dateKey;
          const summary =
            dayEntries.length === 0
              ? 'Nothing planned'
              : dayEntries
                  .map((e) => recipeById.get(e.recipeId)?.title ?? 'Recipe')
                  .slice(0, 2)
                  .join(', ') + (dayEntries.length > 2 ? ` +${dayEntries.length - 2}` : '');

          const toggleExpanded = () => {
            hapticLight();
            setPickerDate(null);
            setExpandedDay((prev) => (prev === dateKey ? '' : dateKey));
          };

          return (
            <div
              key={dateKey}
              className={`rounded-2xl border overflow-hidden ${
                isToday
                  ? 'border-[#2D4635]/50 dark:border-emerald-500/50'
                  : 'border-stone-100 dark:border-[var(--border-color)]'
              } bg-white dark:bg-[var(--card-bg)]`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={toggleExpanded}
                  aria-expanded={isExpanded}
                  className="flex flex-1 min-w-0 items-center gap-3 text-left min-h-11"
                >
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                      {date.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span
                      className={`text-base font-serif leading-none ${
                        isToday ? 'text-[#2D4635] dark:text-emerald-300 font-bold' : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${dayEntries.length === 0 ? 'text-stone-400 dark:text-stone-500 font-serif italic' : isExpanded ? 'text-stone-500 dark:text-stone-400 text-xs uppercase tracking-widest font-bold' : 'text-stone-700 dark:text-stone-300'}`}>
                      {isExpanded
                        ? `${dayEntries.length} recipe${dayEntries.length === 1 ? '' : 's'} planned`
                        : summary}
                    </p>
                  </div>
                  <span aria-hidden className="text-stone-400 text-xs shrink-0">{isExpanded ? '▾' : '▸'}</span>
                </button>
                <button
                  type="button"
                  data-testid="meal-plan-add-recipe"
                  onClick={() => {
                    hapticLight();
                    setQuery('');
                    setExpandedDay(dateKey);
                    setPickerDate(pickerOpen ? null : dateKey);
                  }}
                  aria-expanded={pickerOpen}
                  className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#2D4635] dark:text-emerald-400 hover:underline min-h-11 px-2"
                >
                  {pickerOpen ? 'Close' : '+ Add'}
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-3 border-t border-stone-100 dark:border-[var(--border-color)] pt-2 space-y-2">
                  {dayEntries.length === 0 ? (
                    <p className="text-sm text-stone-400 dark:text-stone-500 font-serif italic py-1">Nothing planned</p>
                  ) : (
                    <ul className="space-y-1">
                      {dayEntries.map((entry) => {
                        const recipe = recipeById.get(entry.recipeId);
                        return (
                          <li key={entry.id} data-testid="meal-plan-entry" className="flex items-center gap-2">
                            {recipe ? (
                              <button
                                type="button"
                                onClick={() => onViewRecipe(recipe)}
                                className="flex-1 text-left text-sm font-serif italic text-stone-700 dark:text-stone-300 hover:text-[#2D4635] dark:hover:text-emerald-400 truncate min-h-11 py-1"
                              >
                                {recipe.title}
                              </button>
                            ) : (
                              <span className="flex-1 text-sm text-stone-400 italic truncate">Recipe unavailable</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemove(entry.id)}
                              className="text-stone-300 hover:text-red-500 text-xs min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                              aria-label={`Remove ${recipe?.title ?? 'recipe'} from ${date.toLocaleDateString(undefined, {
                                weekday: 'long',
                              })}`}
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {dayEntries.length > 0 && (
                    <button
                      type="button"
                      data-testid="meal-plan-copy-day"
                      onClick={() => handleCopyDayForward(dateKey, i)}
                      className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-[#2D4635] dark:hover:text-emerald-400 hover:underline min-h-11"
                      aria-label={`Copy ${date.toLocaleDateString(undefined, { weekday: 'long' })}'s recipes to the next day`}
                    >
                      Copy → next day
                    </button>
                  )}
                </div>
              )}

              {pickerOpen && (
                <div className="px-4 pb-4 border-t border-stone-100 dark:border-[var(--border-color)] pt-3 space-y-3 animate-fade-slide-in">
                  <label htmlFor="meal-plan-recipe-search" className="sr-only">
                    Search recipes by name, ingredient, or contributor to add to the meal plan
                  </label>
                  <input
                    id="meal-plan-recipe-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, ingredient, or cook…"
                    className="w-full px-4 py-3 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#2D4635]/10"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {pickerResults.length === 0 ? (
                      <p className="py-4 text-sm text-stone-400 text-center font-serif italic">No recipes match.</p>
                    ) : (
                      pickerResults.map((r) => {
                        const already = dayEntries.some((e) => e.recipeId === r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            data-testid="meal-plan-picker-option"
                            onClick={() => !already && handleAdd(dateKey, r.id)}
                            disabled={already}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                              already
                                ? 'text-stone-400 cursor-default'
                                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            <span className="flex-1 truncate">{r.title}</span>
                            {already && <span className="text-[10px] text-emerald-500 font-bold">Added</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 z-10 -mx-1 px-3 py-3 mt-2 rounded-2xl border border-stone-200/80 bg-[#FDFBF7]/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(45,70,53,0.08)]">
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="meal-plan-generate-groceries"
          onClick={handleGenerateGroceries}
          disabled={weekRecipeCount === 0}
          className="min-h-11 px-5 py-3 rounded-full bg-[#2D4635] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1e2f23] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add this week to Grocery List
        </button>
        <button
          type="button"
          data-testid="meal-plan-copy-week"
          onClick={handleCopyWeek}
          disabled={weekRecipeCount === 0}
          className="min-h-11 px-5 py-3 rounded-full border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Copy week → next week
        </button>
        <span className="text-xs text-stone-400 dark:text-stone-500 ml-auto hidden sm:inline">
          {weekRecipeCount} recipe{weekRecipeCount === 1 ? '' : 's'} planned
        </span>
        </div>
      </div>
    </section>
  );
};

export default MealPlanView;
