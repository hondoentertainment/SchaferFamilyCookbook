import React from 'react';
import { STORAGE_KEYS } from '../constants/storage';

interface FamilySubNavHintProps {
    onDismiss: () => void;
}

export const FamilySubNavHint: React.FC<FamilySubNavHintProps> = ({ onDismiss }) => {
    const handleDismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEYS.familySubNavHintDismissed, '1');
        } catch {
            /* ignore */
        }
        onDismiss();
    };

    return (
        <div
            role="status"
            className="mx-auto max-w-[1400px] px-3 md:px-6 pt-2"
            data-testid="family-subnav-hint"
        >
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DCCB] bg-[#FFF8EC] px-3 py-2 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200">
                <p>
                    Gallery, trivia, story, and people are in the row below.
                </p>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="min-h-11 shrink-0 rounded-full border border-stone-200 bg-white px-4 py-2 label text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};
