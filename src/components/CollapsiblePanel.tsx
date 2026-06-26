import React, { useState } from 'react';
import { hapticLight } from '../utils/haptics';

interface CollapsiblePanelProps {
    id: string;
    title: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
    panelClassName?: string;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
    id,
    title,
    children,
    defaultOpen = false,
    className = '',
    panelClassName = '',
}) => {
    const [open, setOpen] = useState(defaultOpen);
    const panelId = `${id}-panel`;

    return (
        <section
            aria-labelledby={id}
            className={`rounded-[2rem] border border-stone-200 bg-white shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)] overflow-hidden ${className}`.trim()}
        >
            <button
                type="button"
                onClick={() => {
                    hapticLight();
                    setOpen((v) => !v);
                }}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-stone-50/80 dark:hover:bg-stone-800/60 transition-colors min-h-11"
            >
                <span id={id} className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
                    {title}
                </span>
                <span aria-hidden="true" className="text-stone-400 dark:text-stone-500 text-xs shrink-0">
                    {open ? '▾' : '▸'}
                </span>
            </button>
            {open && (
                <div
                    id={panelId}
                    className={`px-5 pb-5 pt-1 border-t border-stone-100 dark:border-[var(--border-color)] ${panelClassName}`.trim()}
                >
                    {children}
                </div>
            )}
        </section>
    );
};
