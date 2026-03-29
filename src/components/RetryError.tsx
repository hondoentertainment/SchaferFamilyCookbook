import React from 'react';

interface RetryErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

/**
 * Inline error banner with retry button.
 * Use when an operation fails and can be retried.
 */
export const RetryError: React.FC<RetryErrorProps> = ({ message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm ${className}`}
  >
    <span className="text-red-600 shrink-0" aria-hidden>⚠️</span>
    <p className="text-red-700 flex-1">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors min-h-[2.75rem]"
    >
      Retry
    </button>
  </div>
);
