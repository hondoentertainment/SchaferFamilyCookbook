import React, { useEffect, useId, useRef, useState } from 'react';
import { useSiteSearch } from '../context/SearchContext';
import { hapticLight } from '../utils/haptics';
import { searchKindLabel, type SearchHit } from '../utils/siteSearch';

export const SITE_SEARCH_LABEL = 'Search recipes, ingredients, people, or stories';

interface SiteSearchProps {
    id: string;
    /** `page` sits in the tab content; `header` is the compact overlay trigger */
    variant?: 'page' | 'header';
    /** Recipes keeps the panel to focus so the ranked grid stays visible. */
    openOn?: 'focus' | 'query';
    autoFocus?: boolean;
    placeholder?: string;
    className?: string;
}

const KIND_EMOJI: Record<SearchHit['kind'], string> = {
    recipe: '🍽️',
    person: '👤',
    grocery: '🛒',
    gallery: '📷',
    story: '📖',
};

function useKeyboardAvoidance(inputRef: React.RefObject<HTMLInputElement | null>, active: boolean) {
    useEffect(() => {
        if (!active) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const keepVisible = () => {
            if (document.activeElement === inputRef.current) {
                inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        };
        vv.addEventListener('resize', keepVisible);
        vv.addEventListener('scroll', keepVisible);
        return () => {
            vv.removeEventListener('resize', keepVisible);
            vv.removeEventListener('scroll', keepVisible);
        };
    }, [active, inputRef]);
}

function SearchGlyph() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16.5 20.5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export const SiteSearch: React.FC<SiteSearchProps> = ({
    id,
    variant = 'page',
    openOn = 'query',
    autoFocus = false,
    placeholder = 'Search recipes, ingredients, people…',
    className = '',
}) => {
    const {
        query,
        setQuery,
        hits,
        recent,
        clearQuery,
        clearRecent,
        applyRecent,
        onSelectHit,
        headerOpen,
        setHeaderOpen,
    } = useSiteSearch();
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const listId = useId();
    const isHeader = variant === 'header';
    const showPanel = isHeader
        ? headerOpen
        : focused || (openOn === 'query' && query.trim().length > 0);
    const trimmed = query.trim();
    const showRecent = showPanel && !trimmed && recent.length > 0;
    const showEmpty = showPanel && trimmed.length > 0 && hits.length === 0;
    const showHits = showPanel && trimmed.length > 0 && hits.length > 0;

    useKeyboardAvoidance(inputRef, showPanel);

    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        if (isHeader && headerOpen) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        }
    }, [isHeader, headerOpen]);

    useEffect(() => {
        setActiveIndex(-1);
    }, [query, showHits, showRecent]);

    useEffect(() => {
        if (!showPanel) return;
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (panelRef.current?.contains(target) || inputRef.current?.contains(target)) return;
            if (isHeader) setHeaderOpen(false);
            else setFocused(false);
        };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, [isHeader, setHeaderOpen, showPanel]);

    const selectable: Array<{ type: 'hit'; hit: SearchHit } | { type: 'recent'; value: string }> = showHits
        ? hits.map((hit) => ({ type: 'hit' as const, hit }))
        : showRecent
            ? recent.map((value) => ({ type: 'recent' as const, value }))
            : [];

    const choose = (item: (typeof selectable)[number]) => {
        hapticLight();
        if (item.type === 'hit') {
            onSelectHit(item.hit);
            setFocused(false);
            if (isHeader) setHeaderOpen(false);
        } else {
            applyRecent(item.value);
        }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (trimmed) {
                clearQuery();
                return;
            }
            setFocused(false);
            if (isHeader) setHeaderOpen(false);
            inputRef.current?.blur();
            return;
        }
        if (event.key === 'ArrowDown' && selectable.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % selectable.length);
            return;
        }
        if (event.key === 'ArrowUp' && selectable.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index <= 0 ? selectable.length - 1 : index - 1));
            return;
        }
        if (event.key === 'Enter') {
            if (activeIndex >= 0 && selectable[activeIndex]) {
                event.preventDefault();
                choose(selectable[activeIndex]);
                return;
            }
            if (hits[0]) {
                event.preventDefault();
                choose({ type: 'hit', hit: hits[0] });
            }
        }
    };

    const field = (
        <div className={`relative min-w-0 ${isHeader ? 'w-full' : 'flex-1'} ${className}`.trim()}>
            <label htmlFor={id} className="sr-only">
                {SITE_SEARCH_LABEL}
            </label>
            <input
                ref={inputRef}
                id={id}
                data-site-search-input={isHeader ? 'header' : 'page'}
                data-testid={isHeader ? 'header-site-search' : `${id}-input`}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={placeholder}
                aria-label={SITE_SEARCH_LABEL}
                aria-controls={showPanel ? listId : undefined}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={onKeyDown}
                className="min-h-12 w-full rounded-2xl border border-[#E8DCCB] bg-white/95 py-3 pl-4 pr-12 text-base text-stone-900 shadow-inner outline-none transition-all placeholder:text-stone-500 focus:border-[#A0522D] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-400"
            />
            {query ? (
                <button
                    type="button"
                    onClick={() => {
                        hapticLight();
                        clearQuery();
                        inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-100 text-sm text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200"
                >
                    ✕
                </button>
            ) : null}

            {showPanel && (showHits || showRecent || showEmpty) && (
                <div
                    ref={panelRef}
                    id={listId}
                    role="listbox"
                    aria-label="Search results"
                    data-testid="site-search-results"
                    className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 max-h-[min(24rem,calc(100dvh-8rem))] overflow-y-auto rounded-2xl border border-[#E8DCCB] bg-[#FFF8EC] p-2 shadow-[0_16px_40px_rgba(45,70,53,0.16)] dark:border-stone-700 dark:bg-stone-900"
                >
                    {showHits &&
                        hits.map((hit, index) => (
                            <button
                                key={hit.id}
                                type="button"
                                role="option"
                                aria-selected={index === activeIndex}
                                data-kind={hit.kind}
                                onClick={() => choose({ type: 'hit', hit })}
                                className={`flex min-h-12 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${
                                    index === activeIndex
                                        ? 'bg-[var(--color-brand)] text-white'
                                        : 'text-stone-800 hover:bg-white dark:text-stone-100 dark:hover:bg-stone-800'
                                }`}
                            >
                                <span aria-hidden className="mt-0.5 text-base">
                                    {KIND_EMOJI[hit.kind]}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-serif text-base italic">{hit.title}</span>
                                    <span
                                        className={`block truncate text-xs ${
                                            index === activeIndex ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'
                                        }`}
                                    >
                                        {searchKindLabel(hit.kind)} · {hit.subtitle}
                                    </span>
                                </span>
                            </button>
                        ))}

                    {showRecent && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-2 pt-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
                                    Recent searches
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        hapticLight();
                                        clearRecent();
                                    }}
                                    className="min-h-11 px-2 text-xs font-semibold text-[#A0522D]"
                                >
                                    Clear
                                </button>
                            </div>
                            {recent.map((value, index) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    onClick={() => choose({ type: 'recent', value })}
                                    className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm ${
                                        index === activeIndex
                                            ? 'bg-[var(--color-brand)] text-white'
                                            : 'text-stone-700 hover:bg-white dark:text-stone-200 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    )}

                    {showEmpty && (
                        <div className="space-y-3 px-3 py-4 text-center" data-testid="site-search-empty">
                            <p className="font-serif text-lg italic text-[var(--color-brand)] dark:text-emerald-100">
                                Nothing matches “{trimmed}”.
                            </p>
                            <p className="text-sm text-stone-600 dark:text-stone-300">
                                Try a dish name, an ingredient, or a family member — or browse Recipes.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        hapticLight();
                                        clearQuery();
                                    }}
                                    className="min-h-11 rounded-full bg-[var(--color-brand)] px-4 text-sm font-bold text-white"
                                >
                                    Clear search
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    if (!isHeader) return field;

    return (
        <div className="relative" data-testid="header-search">
            <button
                type="button"
                data-testid="header-search-toggle"
                aria-label={headerOpen ? 'Close search' : 'Search the cookbook'}
                aria-expanded={headerOpen}
                aria-controls={headerOpen ? id : undefined}
                onClick={() => {
                    hapticLight();
                    setHeaderOpen(!headerOpen);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-transparent text-stone-700 transition-colors hover:border-[#E8DCCB] hover:bg-white/75 dark:text-stone-300 dark:hover:bg-stone-800"
            >
                <SearchGlyph />
            </button>
            {headerOpen && (
                <div className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(calc(100vw-1.5rem),22rem)] rounded-2xl border border-[#E8DCCB] bg-[#FFF8EC]/95 p-2 shadow-[0_16px_40px_rgba(45,70,53,0.16)] dark:border-stone-700 dark:bg-stone-950/95">
                    {field}
                </div>
            )}
        </div>
    );
};
