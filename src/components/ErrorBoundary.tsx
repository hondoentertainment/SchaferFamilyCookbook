import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '@sentry/react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Catches React render errors so the whole app does not white-screen.
 * Reports to Sentry when @sentry/react is initialized (see monitoring/sentry.ts).
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary]', error, info.componentStack);
        captureException(error, {
            extra: { componentStack: info.componentStack },
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div
                    role="alert"
                    className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#FDFBF7] text-stone-800"
                >
                    <h1 className="text-2xl font-serif italic text-[#2D4635]">Something went wrong</h1>
                    <p className="text-stone-600 mt-3 text-center max-w-md leading-relaxed">
                        Please reload the page. If this keeps happening, contact a family administrator.
                    </p>
                    <button
                        type="button"
                        className="mt-8 px-8 py-3 bg-[#2D4635] text-white rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#1e2f23] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                        onClick={() => window.location.reload()}
                    >
                        Reload
                    </button>
                </div>
            );
        }
        return (this as React.Component<Props, State>).props.children;
    }
}
