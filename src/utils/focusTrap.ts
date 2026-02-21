import React from 'react';

/**
 * Focus trap for modals: keeps focus within the given element and returns focus on unmount.
 */
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
    const previouslyFocused = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
        if (!active || !containerRef.current) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;
        const container = containerRef.current;

        const focusable = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (first) first.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            previouslyFocused.current?.focus?.();
        };
    }, [active, containerRef]);
}
