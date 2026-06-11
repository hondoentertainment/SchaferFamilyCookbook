import React from 'react';

interface LoadingSpinnerProps {
    /** Pixel size of the spinner; defaults to 16 (small/inline). */
    size?: number;
    label?: string;
    className?: string;
}

/**
 * Inline spinner for buttons and small affordances. Respects reduced motion.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 16,
    label = 'Loading',
    className = '',
}) => (
    <span
        role="status"
        aria-label={label}
        className={`inline-block animate-spin motion-reduce:animate-none border-2 border-current border-t-transparent rounded-full${className ? ' ' + className : ''}`}
        style={{ width: size, height: size }}
    />
);
