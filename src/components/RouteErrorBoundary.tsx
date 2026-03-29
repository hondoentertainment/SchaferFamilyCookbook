import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '@sentry/react';

interface Props {
    children: ReactNode;
    /** Optional label shown in the error UI, e.g. "Gallery" */
    label?: string;
}

interface State {
    hasError: boolean;
}

/**
 * Route-level error boundary. If a single route view crashes,
 * only that section shows an error - the rest of the app stays usable.
 */
export class RouteErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[RouteErrorBoundary]', error, info.componentStack);
        captureException(error, {
            extra: { componentStack: info.componentStack },
        });
    }

    render(): ReactNode {
        const self = this as React.Component<Props, State>;
        if (this.state.hasError) {
            return (
                <div
                    role="alert"
                    className="flex flex-col items-center justify-center p-12 text-center min-h-[40vh]"
                >
                    <span className="text-5xl mb-4" aria-hidden>
                        ⚠️
                    </span>
                    <h2 className="text-xl font-serif italic text-[#2D4635] mb-2">
                        {self.props.label
                            ? `Something went wrong loading ${self.props.label}`
                            : 'Something went wrong'}
                    </h2>
                    <p className="text-stone-500 mb-6 max-w-md">
                        This section encountered an error. The rest of the app should still work.
                    </p>
                    <button
                        type="button"
                        className="px-6 py-3 bg-[#2D4635] text-white rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#1e2f23] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                        onClick={() => self.setState({ hasError: false })}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return self.props.children;
    }
}
