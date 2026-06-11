import React from 'react';
import { hapticLight } from '../../utils/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    /** Append extra classes when escape-hatching for layout. */
    className?: string;
    /** Skip the default haptic tap. */
    noHaptic?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-brand text-white shadow-[0_8px_22px_rgba(45,70,53,0.22)] ' +
        'hover:bg-brand-ink active:bg-brand-ink ' +
        'disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed',
    secondary:
        'bg-white text-stone-700 border border-stone-200 ' +
        'hover:bg-stone-50 hover:border-stone-300 ' +
        'dark:bg-stone-900 dark:text-stone-200 dark:border-stone-700 dark:hover:bg-stone-800 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    tertiary:
        'bg-transparent text-brand ' +
        'hover:underline underline-offset-4 ' +
        'dark:text-emerald-400 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    danger:
        'bg-red-50 text-red-600 border border-red-100 ' +
        'hover:bg-red-100 ' +
        'dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:
        'bg-transparent text-stone-700 ' +
        'hover:bg-stone-100 ' +
        'dark:text-stone-200 dark:hover:bg-stone-800 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full',
    md: 'min-h-11 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-full',
    lg: 'min-h-12 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-full',
};

const baseClasses =
    'inline-flex items-center justify-center gap-2 ' +
    'transition-colors duration-150 motion-reduce:transition-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
    'active:scale-[0.98] motion-reduce:active:scale-100 select-none';

/**
 * Standard button used across the app. Replaces the 11+ ad-hoc inline-class
 * patterns identified in the design review. Use the `variant` and `size`
 * props rather than overriding `className` with raw colors/sizing.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', fullWidth = false, className = '', noHaptic = false, onClick, type = 'button', children, ...rest },
    ref,
) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!noHaptic) hapticLight();
        onClick?.(e);
    };

    return (
        <button
            ref={ref}
            type={type}
            onClick={handleClick}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}${fullWidth ? ' w-full' : ''}${className ? ' ' + className : ''}`}
            {...rest}
        >
            {children}
        </button>
    );
});
