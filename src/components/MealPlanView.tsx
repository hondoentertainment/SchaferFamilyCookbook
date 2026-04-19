import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { Recipe } from '../types';
import {
    addDays,
    addEntry,
    clearWeek,
    getEntriesForWeek,
    getWeekStart,
    parseDate,
    removeEntry,
    subscribe,
    type MealPlanEntry,
} from '../utils/mealPlan';
import { hapticLight } from '../utils/haptics';

interface MealPlanViewProps {
    recipes: Recipe[];
    onSelectRecipe?: (recipe: Recipe) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_FULL = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const MONTHS_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/**
 * Build a "April 13–19, 2026" style label for the week.
 * Handles month-spanning weeks like "Apr 27 – May 3, 2026".
 */
function formatWeekRange(weekStart: string): string {
    const start = parseDate(weekStart);
    const end = parseDate(addDays(weekStart, 6));
    const startMonth = MONTHS_SHORT[start.getMonth()];
    const endMonth = MONTHS_SHORT[end.getMonth()];
    const year = end.getFullYear();
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
    }
    if (start.getFullYear() !== end.getFullYear()) {
        return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

interface RecipePickerProps {
    recipes: Recipe[];
    dayLabel: string;
    onClose: () => void;
    onPick: (recipe: Recipe) => void;
}

const RecipePicker: React.FC<RecipePickerProps> = ({ recipes, dayLabel, onClose, onPick }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
        if (!q) return sorted.slice(0, 100);
        return sorted.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 100);
    }, [recipes, query]);

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/60 dark:bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Add a recipe to ${dayLabel}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
        >
            <div
                ref={dialogRef}
                className="w-full max-w-md bg-white dark:bg-[var(--bg-secondary,#1f1f1f)] rounded-3xl shadow-2xl border border-stone-100 dark:border-[var(--border-color,#333)] overflow-hidden flex flex-col max-h-[80vh]"
            >
                <div className="px-5 pt-5 pb-3 border-b border-stone-100 dark:border-[var(--border-color,#333)]">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h3 className="font-serif italic text-xl text-[#2D4635] dark:text-emerald-300">
                                Add to {dayLabel}
                            </h3>
                            <p className="text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-1">
                                Pick a recipe
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close recipe picker"
                            className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                            <span aria-hidden className="text-2xl leading-none">×</span>
                        </button>
                    </div>
                    <input
                        ref={inputRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by title…"
                        aria-label="Search recipes"
                        className="w-full px-4 py-3 bg-stone-50 dark:bg-[var(--input-bg,#2a2a2a)] border border-stone-200 dark:border-[var(--border-color,#333)] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2D4635]/20"
                    />
                </div>
                <ul
                    role="listbox"
                    aria-label="Recipe options"
                    className="flex-1 overflow-y-auto py-2"
                >
                    {filtered.length === 0 ? (
                        <li className="px-5 py-6 text-center text-sm text-stone-500 italic font-serif">
                            No recipes match "{query}".
                        </li>
                    ) : (
                        filtered.map((r) => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected="false"
                                    onClick={() => {
                                        hapticLight();
                                        onPick(r);
                                    }}
                                    className="w-full text-left px-5 py-3 min-h-11 hover:bg-stone-50 dark:hover:bg-stone-800 focus-visible:bg-stone-50 dark:focus-visible:bg-stone-800 outline-none transition-colors"
                                >
                                    <div className="font-bold text-stone-800 dark:text-stone-100 text-sm">
                                        {r.title}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-0.5">
                                        {r.category} · {r.contributor}
                                    </div>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
};

export const MealPlanView: React.FC<MealPlanViewProps> = ({ recipes, onSelectRecipe }) => {
    const [weekStart, setWeekStart] = useState<string>(() => getWeekStart(new Date()));
    const [entries, setEntries] = useState<MealPlanEntry[]>(() => getEntriesForWeek(weekStart));
    const [pickerDay, setPickerDay] = useState<number | null>(null);

    // Reload entries whenever the week changes or the store dispatches a change event.
    useEffect(() => {
        setEntries(getEntriesForWeek(weekStart));
        const unsub = subscribe(() => setEntries(getEntriesForWeek(weekStart)));
        return unsub;
    }, [weekStart]);

    const recipesById = useMemo(() => {
        const map = new Map<string, Recipe>();
        recipes.forEach((r) => map.set(r.id, r));
        return map;
    }, [recipes]);

    const entriesByDay = useMemo(() => {
        const grouped: Record<number, MealPlanEntry[]> = {};
        for (let i = 0; i < 7; i++) grouped[i] = [];
        entries.forEach((e) => {
            if (grouped[e.day]) grouped[e.day].push(e);
        });
        return grouped;
    }, [entries]);

    const totalCount = entries.length;

    const goPrev = () => {
        hapticLight();
        setWeekStart((w) => addDays(w, -7));
    };
    const goNext = () => {
        hapticLight();
        setWeekStart((w) => addDays(w, 7));
    };
    const goThisWeek = () => {
        hapticLight();
        setWeekStart(getWeekStart(new Date()));
    };

    const handleClearWeek = () => {
        hapticLight();
        clearWeek(weekStart);
    };

    const openPicker = (day: number) => {
        hapticLight();
        setPickerDay(day);
    };

    const handlePick = (recipe: Recipe) => {
        if (pickerDay == null) return;
        addEntry(weekStart, pickerDay, { id: recipe.id, title: recipe.title });
        setPickerDay(null);
    };

    const handleRemove = (id: string) => {
        hapticLight();
        removeEntry(id);
    };

    const handleCardClick = (e: MealPlanEntry) => {
        const r = recipesById.get(e.recipeId);
        if (r && onSelectRecipe) onSelectRecipe(r);
    };

    const isThisWeek = weekStart === getWeekStart(new Date());

    return (
        <main
            className="max-w-7xl mx-auto py-8 md:py-12 pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]"
            aria-label="Weekly meal plan"
        >
            <header className="mb-8">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-serif italic text-[#2D4635] dark:text-emerald-300">
                            Meal Plan
                        </h2>
                        <p
                            data-testid="meal-plan-week-range"
                            className="mt-2 text-base md:text-lg text-stone-600 dark:text-stone-300"
                        >
                            {formatWeekRange(weekStart)}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-1">
                            {totalCount} {totalCount === 1 ? 'recipe' : 'recipes'} planned
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={goPrev}
                            aria-label="Previous week"
                            className="min-h-11 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white dark:bg-[var(--bg-secondary,#1f1f1f)] border border-stone-200 dark:border-[var(--border-color,#333)] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                        >
                            ← Prev
                        </button>
                        <button
                            type="button"
                            onClick={goThisWeek}
                            aria-label="Jump to this week"
                            aria-pressed={isThisWeek}
                            className={`min-h-11 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                                isThisWeek
                                    ? 'bg-[#2D4635] text-white shadow-md'
                                    : 'bg-white dark:bg-[var(--bg-secondary,#1f1f1f)] border border-stone-200 dark:border-[var(--border-color,#333)] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                            }`}
                        >
                            This Week
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            aria-label="Next week"
                            className="min-h-11 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white dark:bg-[var(--bg-secondary,#1f1f1f)] border border-stone-200 dark:border-[var(--border-color,#333)] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                        >
                            Next →
                        </button>
                        {totalCount > 0 && (
                            <button
                                type="button"
                                onClick={handleClearWeek}
                                aria-label="Clear all recipes from this week"
                                className="min-h-11 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                                Clear Week
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div
                aria-label="Days of the week"
                className="grid grid-cols-1 md:grid-cols-7 gap-3 md:gap-4"
            >
                {DAY_LABELS.map((label, day) => {
                    const dateStr = addDays(weekStart, day);
                    const date = parseDate(dateStr);
                    const dayEntries = entriesByDay[day];
                    const today = new Date();
                    const isToday =
                        date.getFullYear() === today.getFullYear() &&
                        date.getMonth() === today.getMonth() &&
                        date.getDate() === today.getDate();
                    return (
                        <section
                            key={day}
                            aria-label={`${DAY_LABELS_FULL[day]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`}
                            data-testid={`meal-plan-day-${day}`}
                            className={`flex flex-col rounded-2xl border bg-white dark:bg-[var(--bg-secondary,#1f1f1f)] p-3 md:p-4 min-h-[10rem] ${
                                isToday
                                    ? 'border-[#2D4635] dark:border-emerald-400 shadow-md'
                                    : 'border-stone-200 dark:border-[var(--border-color,#333)]'
                            }`}
                        >
                            <header className="flex items-baseline justify-between mb-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
                                    {label}
                                    {isToday && (
                                        <span className="ml-1 text-[#2D4635] dark:text-emerald-400">
                                            · Today
                                        </span>
                                    )}
                                </h3>
                                <span className="text-xs font-serif italic text-stone-400 dark:text-stone-500">
                                    {date.getDate()}
                                </span>
                            </header>
                            <ul className="flex-1 space-y-2 mb-3">
                                {dayEntries.length === 0 ? (
                                    <li className="text-xs text-stone-400 dark:text-stone-500 italic font-serif py-2">
                                        Nothing planned.
                                    </li>
                                ) : (
                                    dayEntries.map((entry) => (
                                        <li
                                            key={entry.id}
                                            className="group flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 rounded-xl px-3 py-2 border border-stone-100 dark:border-stone-700"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleCardClick(entry)}
                                                className="flex-1 text-left text-sm text-stone-800 dark:text-stone-100 truncate hover:text-[#2D4635] dark:hover:text-emerald-300 transition-colors min-h-11"
                                                aria-label={`Open recipe: ${entry.recipeTitle}`}
                                            >
                                                {entry.recipeTitle}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(entry.id)}
                                                aria-label={`Remove ${entry.recipeTitle} from ${DAY_LABELS_FULL[day]}`}
                                                className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                            >
                                                <span aria-hidden className="text-lg leading-none">
                                                    ×
                                                </span>
                                            </button>
                                        </li>
                                    ))
                                )}
                            </ul>
                            <button
                                type="button"
                                onClick={() => openPicker(day)}
                                aria-label={`Add a recipe to ${DAY_LABELS_FULL[day]}`}
                                data-testid={`meal-plan-add-${day}`}
                                className="w-full min-h-11 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider hover:border-[#2D4635] hover:text-[#2D4635] dark:hover:border-emerald-400 dark:hover:text-emerald-300 transition-colors"
                            >
                                + Add recipe
                            </button>
                        </section>
                    );
                })}
            </div>

            {pickerDay !== null && (
                <RecipePicker
                    recipes={recipes}
                    dayLabel={DAY_LABELS_FULL[pickerDay]}
                    onClose={() => setPickerDay(null)}
                    onPick={handlePick}
                />
            )}
        </main>
    );
};
