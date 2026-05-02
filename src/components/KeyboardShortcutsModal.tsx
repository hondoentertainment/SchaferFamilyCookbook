import React, { useEffect, useRef } from 'react';
import { KEYBOARD_SHORTCUT_ROWS } from '../constants/keyboardShortcuts';
import { useFocusTrap } from '../utils/focusTrap';

interface KeyboardShortcutsModalProps {
    open: boolean;
    onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ open, onClose }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useFocusTrap(open, panelRef);

    useEffect(() => {
        if (!open) return;
        closeBtnRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-5 animate-in fade-in duration-200 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm motion-reduce:backdrop-blur-none"
                aria-label="Dismiss shortcuts"
                onClick={onClose}
            />
            <div
                ref={panelRef}
                className="relative z-10 w-full max-w-md rounded-[2rem] border border-stone-200 bg-[#FDFBF7] p-6 shadow-2xl dark:border-stone-700 dark:bg-[var(--card-bg)] motion-reduce:animate-none"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="shortcuts-modal-title" className="font-serif text-2xl italic text-[#2D4635] dark:text-emerald-100">
                            Keyboard shortcuts
                        </h2>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                            Works when focus isn&apos;t inside a text field.
                        </p>
                    </div>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 shrink-0 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[var(--bg-tertiary)] dark:text-stone-300 dark:hover:bg-stone-600 transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] motion-reduce:transition-none"
                        aria-label="Close shortcuts"
                    >
                        ✕
                    </button>
                </div>
                <ul className="mt-6 space-y-3">
                    {KEYBOARD_SHORTCUT_ROWS.map((row) => (
                        <li key={row.keys} className="flex gap-4 rounded-2xl border border-stone-100 bg-white/80 px-4 py-3 dark:border-[var(--border-color)] dark:bg-stone-900/40">
                            <kbd className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                                {row.keys}
                            </kbd>
                            <span className="text-sm text-stone-700 dark:text-stone-300">{row.description}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-6 text-center text-xs text-stone-500 dark:text-stone-400">
                    More tips live under Profile → Help &amp; shortcuts.
                </p>
            </div>
        </div>
    );
};
