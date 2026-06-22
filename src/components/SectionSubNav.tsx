import React from 'react';
import type { SecondaryNavItem } from '../config/navConfig';

interface SectionSubNavProps {
    ariaLabel: string;
    items: SecondaryNavItem[];
    activeTab: string;
    onSelect: (tabId: string) => void;
    getDetail?: (id: string) => string | undefined;
}

export const SectionSubNav: React.FC<SectionSubNavProps> = ({
    ariaLabel,
    items,
    activeTab,
    onSelect,
    getDetail,
}) => (
    <section
        aria-label={ariaLabel}
        className="max-w-[1400px] mx-auto px-3 md:px-6 pt-2 md:pt-4 pb-1"
    >
        <div
            className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            {items.map((item) => {
                const active = activeTab === item.id;
                const detail = getDetail?.(item.id);
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                            onSelect(item.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`min-h-11 shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                            active
                                ? 'bg-[#2D4635] text-white shadow-sm'
                                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700'
                        }`}
                    >
                        {item.icon && (
                            <span aria-hidden className="text-base leading-none">
                                {item.icon}
                            </span>
                        )}
                        <span>{item.label}</span>
                        {detail && (
                            <span
                                className={`hidden sm:inline text-xs font-normal ${
                                    active ? 'text-emerald-100/80' : 'text-stone-500 dark:text-stone-400'
                                }`}
                            >
                                · {detail}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    </section>
);
