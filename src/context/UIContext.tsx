import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { hapticSuccess, hapticError } from '../utils/haptics';
import { useFocusTrap } from '../utils/focusTrap';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

interface ConfirmOptions {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
}

interface UIContextValue {
    toast: (message: string, type?: ToastType) => void;
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIContextValue | null>(null);

export const useUI = () => {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUI must be used within UIProvider');
    return ctx;
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [confirmState, setConfirmState] = useState<{
        message: string;
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);
    const toastIdRef = useRef(0);

    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        if (type === 'success') hapticSuccess();
        else if (type === 'error') hapticError();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
        return new Promise<boolean>(resolve => {
            setConfirmState({ message, options, resolve });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (confirmState) {
            confirmState.resolve(true);
            setConfirmState(null);
        }
    }, [confirmState]);

    const handleCancel = useCallback(() => {
        if (confirmState) {
            confirmState.resolve(false);
            setConfirmState(null);
        }
    }, [confirmState]);

    const confirmContainerRef = useRef<HTMLDivElement>(null);
    useFocusTrap(!!confirmState, confirmContainerRef);
    useEffect(() => {
        if (!confirmState) return;
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [confirmState, handleCancel]);

    return (
        <UIContext.Provider value={{ toast, confirm }}>
            {children}

            {/* Toast container - aria-live for screen readers */}
            <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-xl border font-bold text-sm uppercase tracking-widest animate-in fade-in slide-in-from-bottom-4 duration-300 ${
                            t.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : t.type === 'error'
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-white text-stone-700 border-stone-200'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState && (
                <div
                    className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                    aria-describedby="confirm-desc"
                    onClick={(e) => e.target === e.currentTarget && handleCancel()}
                >
                    <div ref={confirmContainerRef} className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 id="confirm-title" className="text-xl font-serif italic text-[#2D4635] mb-4">
                            {confirmState.options.title || 'Confirm'}
                        </h3>
                        <p id="confirm-desc" className="text-stone-600 mb-8">
                            {confirmState.message}
                        </p>
                        <div className="flex gap-4 justify-end">
                            <button
                                onClick={handleCancel}
                                className="min-h-11 min-w-11 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border border-stone-200 text-stone-500 hover:bg-stone-50 transition-all touch-manipulation"
                            >
                                {confirmState.options.cancelLabel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`min-h-11 min-w-11 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all touch-manipulation ${
                                    confirmState.options.variant === 'danger'
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-[#2D4635] text-white hover:bg-[#1e2f23]'
                                }`}
                            >
                                {confirmState.options.confirmLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
};
