import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
    /** Decorative emoji or short icon string shown above the title. */
    icon?: string;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    /** Optional secondary action shown next to the primary. */
    secondaryAction?: { label: string; onClick: () => void };
    /** Use the dashed/minimal variant for in-flow empty hints (e.g. inside cards). */
    variant?: 'panel' | 'inline';
    className?: string;
}

/**
 * Unified empty-state component. Replaces the ad-hoc emoji + italic-serif text
 * patterns scattered across CollectionsView, GroceryListView, MealPlanView,
 * ActivityFeed, and AlphabeticalIndex.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    secondaryAction,
    variant = 'panel',
    className = '',
}) => {
    const wrapperClasses =
        variant === 'panel'
            ? 'py-16 text-center space-y-4 bg-white/60 dark:bg-stone-900/40 rounded-[2rem] border border-dashed border-stone-200 dark:border-stone-700'
            : 'py-8 text-center space-y-3';

    return (
        <div role="status" className={`${wrapperClasses}${className ? ' ' + className : ''}`}>
            {icon && (
                <span className={variant === 'panel' ? 'block text-5xl' : 'block text-4xl'} aria-hidden="true">
                    {icon}
                </span>
            )}
            <p className="font-serif italic text-stone-600 dark:text-stone-300 text-lg leading-relaxed max-w-md mx-auto px-4">
                {title}
            </p>
            {description && (
                <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto px-4">
                    {description}
                </p>
            )}
            {(action || secondaryAction) && (
                <div className="flex flex-wrap justify-center gap-3 px-4 pt-2">
                    {action && (
                        <Button variant="primary" size="lg" onClick={action.onClick}>
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button variant="secondary" size="lg" onClick={secondaryAction.onClick}>
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};
