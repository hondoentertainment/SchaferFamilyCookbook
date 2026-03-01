import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    getGroceryItems,
    toggleGroceryItem,
    removeGroceryItem,
    clearCheckedItems,
    inferCategory,
    type GroceryItem,
} from '../utils/groceryList';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import type { Recipe } from '../types';

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

interface GroceryListViewProps {
    recipes?: Recipe[];
}

export const GroceryListView: React.FC<GroceryListViewProps> = ({ recipes = [] }) => {
    const { confirm } = useUI();
    const [items, setItems] = useState<GroceryItem[]>([]);
    const [searchRaw, setSearchRaw] = useState('');
    const searchQuery = useDebouncedValue(searchRaw.trim().toLowerCase(), 150);

    const refresh = useCallback(() => setItems(getGroceryItems()), []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const recipeMap = useMemo(() => {
        const m = new Map<string, string>();
        recipes.forEach((r) => m.set(r.id, r.title));
        return m;
    }, [recipes]);

    const filteredAndGrouped = useMemo(() => {
        const filtered = searchQuery
            ? items.filter((i) => i.text.toLowerCase().includes(searchQuery))
            : items;

        const unchecked = filtered.filter((i) => !i.checked);
        const checked = filtered.filter((i) => i.checked);

        const getGroupKey = (item: GroceryItem) => {
            const cat = item.category ?? inferCategory(item.text);
            const src = item.recipeTitle ?? recipeMap.get(item.recipeId ?? '') ?? '';
            return src ? `recipe:${src}` : `cat:${cat}`;
        };

        const groups = new Map<string, GroceryItem[]>();
        for (const item of unchecked) {
            const key = getGroupKey(item);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        }

        const groupOrder = Array.from(groups.keys()).sort();
        const groupedUnchecked = groupOrder.flatMap((key) => groups.get(key)!);

        return { unchecked: groupedUnchecked, checked };
    }, [items, searchQuery, recipeMap]);

    const { unchecked, checked } = filteredAndGrouped;
    const displayItems = [...unchecked, ...checked];
    const hasSearch = searchQuery.length > 0;
    const isEmptySearch = hasSearch && displayItems.length === 0;
    const checkedCount = items.filter((i) => i.checked).length;

    const handleToggle = (id: string) => {
        toggleGroceryItem(id);
        hapticLight();
        refresh();
    };

    const handleRemove = (id: string) => {
        removeGroceryItem(id);
        refresh();
    };

    const handleClearChecked = async () => {
        const ok = await confirm(
            `Clear ${checkedCount} checked item${checkedCount === 1 ? '' : 's'}? This cannot be undone.`,
            { variant: 'danger', confirmLabel: 'Clear checked', cancelLabel: 'Cancel', title: 'Clear checked items' }
        );
        if (ok) {
            clearCheckedItems();
            refresh();
        }
    };

    const getSourceLabel = (item: GroceryItem) => {
        const title = item.recipeTitle ?? (item.recipeId ? recipeMap.get(item.recipeId) : null);
        return title ? `From: ${title}` : null;
    };

    const getGroupHeader = (item: GroceryItem) => {
        const src = getSourceLabel(item);
        if (src) return src;
        return item.category ?? inferCategory(item.text);
    };

    return (
        <div
            className="max-w-2xl mx-auto py-8 md:py-12 px-4 md:px-6 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700"
            role="main"
            aria-label="Grocery list"
        >
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-serif italic text-[#2D4635]">
                    🛒 Grocery List
                </h1>
                {checkedCount > 0 && (
                    <button
                        onClick={handleClearChecked}
                        className="min-h-[2.75rem] min-w-[2.75rem] px-4 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-[#A0522D] transition-colors touch-manipulation rounded-full border border-stone-200 hover:border-[#A0522D]/30"
                        aria-label={`Clear ${checkedCount} checked item${checkedCount === 1 ? '' : 's'}`}
                    >
                        Clear checked ({checkedCount})
                    </button>
                )}
            </header>

            {items.length > 0 && (
                <div className="relative">
                    <label htmlFor="grocery-search" className="sr-only">
                        Search grocery items
                    </label>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg" aria-hidden="true">
                        🔍
                    </span>
                    <input
                        id="grocery-search"
                        type="search"
                        placeholder="Search your list (e.g. flour, butter)"
                        value={searchRaw}
                        onChange={(e) => setSearchRaw(e.target.value)}
                        aria-label="Search grocery items"
                        className="w-full pl-12 pr-6 py-4 min-h-[2.75rem] bg-white border border-stone-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#2D4635]/10 focus:border-[#2D4635]/20 transition-all font-serif italic placeholder:text-stone-300 text-base touch-manipulation"
                        autoComplete="off"
                    />
                    {searchRaw && (
                        <button
                            type="button"
                            onClick={() => setSearchRaw('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-stone-300 hover:text-stone-600 rounded-full touch-manipulation"
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {items.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-stone-100 rounded-[3rem] bg-stone-50/50">
                    <p className="text-stone-400 font-serif italic text-lg">
                        Your grocery list is empty.
                    </p>
                    <p className="text-stone-300 text-sm mt-2">
                        Add ingredients from a recipe.
                    </p>
                </div>
            ) : isEmptySearch ? (
                <div className="py-20 text-center border-2 border-dashed border-stone-100 rounded-[3rem] bg-stone-50/50 animate-in fade-in duration-300">
                    <p className="text-stone-400 font-serif italic text-lg">
                        No items match your search.
                    </p>
                    <p className="text-stone-300 text-sm mt-2">
                        Try a different search term or clear the search.
                    </p>
                    <button
                        type="button"
                        onClick={() => setSearchRaw('')}
                        className="mt-4 px-6 py-3 bg-[#2D4635] text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-[#2D4635]/90 transition-colors touch-manipulation min-h-[2.75rem]"
                        aria-label="Clear search"
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                <ul className="space-y-2">
                    {displayItems.map((item, idx) => {
                        const sourceLabel = getSourceLabel(item);
                        const prev = displayItems[idx - 1];
                        const showGroupHeader =
                            !item.checked &&
                            (!prev || prev.checked || getGroupHeader(prev) !== getGroupHeader(item));
                        return (
                            <React.Fragment key={item.id}>
                                {showGroupHeader && !item.checked && (
                                    <li
                                        className="pt-4 first:pt-0"
                                        role="presentation"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">
                                            {getGroupHeader(item)}
                                        </span>
                                    </li>
                                )}
                                <li
                                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all group"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleToggle(item.id)}
                                    className="shrink-0 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full border-2 flex items-center justify-center transition-colors touch-manipulation"
                                    style={{
                                        borderColor: item.checked ? '#10b981' : '#e7e5e4',
                                        backgroundColor: item.checked ? '#10b981' : 'transparent',
                                    }}
                                    aria-label={item.checked ? `Uncheck ${item.text}` : `Check ${item.text}`}
                                    aria-pressed={item.checked}
                                >
                                    {item.checked && <span className="text-white text-sm">✓</span>}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <span
                                        className={`block text-left ${
                                            item.checked
                                                ? 'line-through text-stone-400'
                                                : 'text-stone-700'
                                        }`}
                                    >
                                        {item.text}
                                    </span>
                                    {sourceLabel && (
                                        <span
                                            className={`block text-xs font-serif italic mt-0.5 ${
                                                item.checked ? 'text-stone-300' : 'text-stone-400'
                                            }`}
                                        >
                                            {sourceLabel}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(item.id)}
                                    className="shrink-0 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center opacity-50 md:opacity-0 md:group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all rounded-full touch-manipulation focus:opacity-100"
                                    aria-label={`Remove ${item.text}`}
                                >
                                    ✕
                                </button>
                            </li>
                            </React.Fragment>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
