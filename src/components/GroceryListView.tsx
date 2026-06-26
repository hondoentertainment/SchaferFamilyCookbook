import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '../context/UIContext';
import { hapticLight } from '../utils/haptics';
import { PageHeader } from './PageHeader';
import { CollapsiblePanel } from './CollapsiblePanel';
import {
    addItems,
    clearAll,
    clearChecked,
    formatGroceryListExport,
    getItems,
    removeItem,
    subscribeGroceryList,
    toggleItem,
    type GroceryItem,
} from '../utils/groceryList';

const OTHER_GROUP = 'Other';

interface GroupedItems {
    title: string;
    items: GroceryItem[];
}

function groupByRecipe(items: GroceryItem[]): GroupedItems[] {
    const order: string[] = [];
    const map = new Map<string, GroceryItem[]>();
    for (const item of items) {
        const key = item.recipeTitle?.trim() ? item.recipeTitle.trim() : OTHER_GROUP;
        if (!map.has(key)) {
            map.set(key, []);
            order.push(key);
        }
        map.get(key)!.push(item);
    }
    // Put "Other" last for tidier presentation
    const ordered = order.filter((k) => k !== OTHER_GROUP);
    if (map.has(OTHER_GROUP)) ordered.push(OTHER_GROUP);
    return ordered.map((title) => ({ title, items: map.get(title)! }));
}

interface GroceryListViewProps {
    onBrowseRecipes?: () => void;
    onOpenCollections?: () => void;
    onOpenMealPlan?: () => void;
    /** When set, scrolls to the recipe group and highlights it briefly */
    highlightRecipeTitle?: string | null;
    onHighlightConsumed?: () => void;
}

export const GroceryListView: React.FC<GroceryListViewProps> = ({
    onBrowseRecipes,
    onOpenCollections,
    onOpenMealPlan,
    highlightRecipeTitle = null,
    onHighlightConsumed,
}) => {
    const { toast, confirm } = useUI();
    const [items, setItems] = useState<GroceryItem[]>(() => getItems());
    const [manualText, setManualText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const groupSectionRefs = useRef<(HTMLElement | null)[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeGroceryList(() => {
            setItems(getItems());
        });
        return unsubscribe;
    }, []);

    const groups = useMemo(() => groupByRecipe(items), [items]);
    const uncheckedGroups = useMemo(
        () =>
            groups
                .map((g) => ({ ...g, items: g.items.filter((i) => !i.checked) }))
                .filter((g) => g.items.length > 0),
        [groups],
    );
    const checkedItems = useMemo(() => items.filter((i) => i.checked), [items]);
    const checkedCount = checkedItems.length;
    const hasItems = items.length > 0;

    useEffect(() => {
        if (!highlightRecipeTitle || !onHighlightConsumed) return;
        const idx = groups.findIndex((g) => g.title === highlightRecipeTitle);
        if (idx < 0) {
            onHighlightConsumed();
            return;
        }
        const el = groupSectionRefs.current[idx];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const t = window.setTimeout(() => onHighlightConsumed(), 4500);
        return () => window.clearTimeout(t);
    }, [highlightRecipeTitle, groups, onHighlightConsumed]);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const scrollInputIntoView = () => {
            if (document.activeElement === inputRef.current) {
                inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        };
        vv.addEventListener('resize', scrollInputIntoView);
        vv.addEventListener('scroll', scrollInputIntoView);
        return () => {
            vv.removeEventListener('resize', scrollInputIntoView);
            vv.removeEventListener('scroll', scrollInputIntoView);
        };
    }, []);

    const handleAddManual = (e: React.FormEvent) => {
        e.preventDefault();
        const text = manualText.trim();
        if (!text) return;
        hapticLight();
        const next = addItems([{ text }]);
        // If nothing was appended (dedup), gently surface that
        if (next.length === items.length) {
            toast('That item is already on your list', 'info');
        }
        setManualText('');
        inputRef.current?.focus();
    };

    const handleToggle = (id: string) => {
        hapticLight();
        toggleItem(id);
    };

    const handleRemove = (id: string, text: string) => {
        hapticLight();
        removeItem(id);
        toast(`Removed "${text}"`, 'info');
    };

    const handleClearChecked = () => {
        if (checkedCount === 0) return;
        hapticLight();
        const n = checkedCount;
        clearChecked();
        toast(`Cleared ${n} checked item${n === 1 ? '' : 's'}`, 'success');
    };

    const handleClearAll = async () => {
        if (!hasItems) return;
        const ok = await confirm(
            'This will remove every item from your grocery list. This cannot be undone.',
            {
                title: 'Clear grocery list?',
                confirmLabel: 'Clear all',
                cancelLabel: 'Cancel',
                variant: 'danger',
            },
        );
        if (!ok) return;
        hapticLight();
        clearAll();
        toast('Grocery list cleared', 'success');
    };

    const handleCopyList = async () => {
        const text = formatGroceryListExport(items);
        if (!text) return;
        hapticLight();
        try {
            await navigator.clipboard.writeText(text);
            toast('List copied to clipboard', 'success');
        } catch {
            toast('Could not copy list', 'error');
        }
    };

    const handleShareList = async () => {
        const text = formatGroceryListExport(items);
        if (!text) return;
        hapticLight();
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: 'Grocery list', text });
                return;
            } catch {
                // user cancelled or share unavailable
            }
        }
        await handleCopyList();
    };

    return (
        <section className="view-shell view-stack" aria-labelledby="grocery-list-heading">
            <PageHeader
                id="grocery-list-heading"
                eyebrow="Cook · Plan · Shop"
                title="Grocery list"
                description={
                    hasItems
                        ? `${items.length} item${items.length === 1 ? '' : 's'} · ${checkedCount} checked`
                        : 'Add ingredients from a recipe, plan your week, or jot anything down below.'
                }
            />

            {hasItems && (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                        <button
                            type="button"
                            onClick={handleCopyList}
                            className="min-h-11 px-4 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                        >
                            Copy list
                        </button>
                        <button
                            type="button"
                            onClick={handleShareList}
                            className="min-h-11 px-4 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                        >
                            Share
                        </button>
                        <button
                            type="button"
                            onClick={handleClearChecked}
                            disabled={checkedCount === 0}
                            className="min-h-11 px-4 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Clear checked{checkedCount > 0 ? ` (${checkedCount})` : ''}
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="min-h-11 px-5 py-2.5 rounded-full text-sm font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        >
                            Clear all
                        </button>
                </div>
            )}

            <form
                onSubmit={handleAddManual}
                className="flex flex-col sm:flex-row gap-3"
                aria-label="Add item to grocery list"
            >
                <label htmlFor="grocery-manual-add" className="sr-only">
                    Add an item to your grocery list
                </label>
                <input
                    id="grocery-manual-add"
                    ref={inputRef}
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Add an item (e.g. 2 lemons)"
                    className="flex-1 min-h-11 px-5 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full text-sm font-serif italic placeholder:text-stone-400 dark:placeholder:text-stone-500 text-stone-800 dark:text-stone-100 outline-none focus:ring-2 focus:ring-[#2D4635]/20"
                />
                <button
                    type="submit"
                    disabled={!manualText.trim()}
                    className="min-h-11 px-6 py-3 rounded-full bg-[#2D4635] text-white text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1e2f23] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Add
                </button>
            </form>

            {!hasItems ? (
                <div
                    role="status"
                    className="py-10 text-center space-y-4 bg-white/60 dark:bg-stone-900/40 rounded-[2rem] border border-dashed border-stone-200 dark:border-stone-700"
                >
                    <span className="text-5xl" aria-hidden="true">
                        🛒
                    </span>
                    <p className="font-serif italic text-stone-600 dark:text-stone-300 text-lg">
                        Your grocery list is empty. Add ingredients from a recipe.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 px-4">
                        {onBrowseRecipes && (
                            <button
                                type="button"
                                onClick={onBrowseRecipes}
                                className="min-h-11 rounded-full bg-[#2D4635] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1e2f23] transition-colors"
                            >
                                Browse recipes
                            </button>
                        )}
                        {onOpenMealPlan && (
                            <button
                                type="button"
                                onClick={onOpenMealPlan}
                                className="min-h-11 rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                            >
                                Plan your week
                            </button>
                        )}
                        {onOpenCollections && (
                            <button
                                type="button"
                                onClick={onOpenCollections}
                                className="min-h-11 rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                            >
                                From a collection
                            </button>
                        )}
                        <p className="w-full text-xs text-stone-400 dark:text-stone-500">
                            Open any recipe and use “Add to grocery list” from the ingredients section, or build a list from Meal Plan.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {uncheckedGroups.map((group, gi) => (
                        <section
                            key={group.title}
                            ref={(el) => {
                                groupSectionRefs.current[gi] = el;
                            }}
                            aria-label={`Grocery items from ${group.title}`}
                            className={`bg-white dark:bg-stone-900 rounded-[2rem] border overflow-hidden shadow-sm transition-[box-shadow] duration-500 ${
                                highlightRecipeTitle === group.title
                                    ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-amber-100/40'
                                    : 'border-stone-100 dark:border-stone-800'
                            }`}
                        >
                            <header className="px-5 py-2.5 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 truncate">
                                    {group.title}
                                </h3>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 tabular-nums">
                                    {group.items.length} left
                                </span>
                            </header>
                            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                                {group.items.map((item) => (
                                    <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => handleToggle(item.id)}
                                                aria-label={`Mark "${item.text}" as ${item.checked ? 'not bought' : 'bought'}`}
                                                className="w-5 h-5 rounded accent-[#2D4635] shrink-0"
                                            />
                                            <span className="text-sm md:text-base flex-1 min-w-0 break-words text-stone-800 dark:text-stone-100">
                                                {item.text}
                                            </span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(item.id, item.text)}
                                            aria-label={`Remove ${item.text}`}
                                            className="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-full text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center transition-colors"
                                            title="Remove"
                                        >
                                            <span className="text-lg leading-none">×</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}

                    {uncheckedGroups.length === 0 && checkedCount > 0 && (
                        <p className="text-center text-sm font-serif italic text-stone-500 dark:text-stone-400 py-4">
                            Everything is checked off — nice work!
                        </p>
                    )}

                    {checkedCount > 0 && (
                        <CollapsiblePanel
                            id="grocery-checked-items"
                            title={`Checked off (${checkedCount})`}
                            defaultOpen={false}
                        >
                            <ul className="space-y-2">
                                {checkedItems.map((item) => (
                                    <li key={item.id} className="flex items-center gap-3 py-1">
                                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked
                                                onChange={() => handleToggle(item.id)}
                                                aria-label={`Mark "${item.text}" as not bought`}
                                                className="w-5 h-5 rounded accent-[#2D4635] shrink-0"
                                            />
                                            <span className="text-sm line-through text-stone-400 dark:text-stone-500 flex-1 min-w-0 break-words">
                                                {item.text}
                                                {item.recipeTitle && (
                                                    <span className="block text-[10px] not-italic uppercase tracking-widest mt-0.5">
                                                        {item.recipeTitle}
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(item.id, item.text)}
                                            aria-label={`Remove ${item.text}`}
                                            className="w-9 h-9 rounded-full text-stone-300 hover:text-red-500 flex items-center justify-center"
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </CollapsiblePanel>
                    )}
                </div>
            )}
        </section>
    );
};

export default GroceryListView;
