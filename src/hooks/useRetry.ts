import { useState, useCallback } from 'react';

interface RetryState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  retry: () => void;
}

/**
 * Hook for retryable async operations with UI state.
 * Shows loading, error with retry button, or success.
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  options?: { maxAttempts?: number; onSuccess?: (data: T) => void }
): RetryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const maxAttempts = options?.maxAttempts ?? 3;

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await operation();
        setData(result);
        setIsLoading(false);
        options?.onSuccess?.(result);
        return;
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        } else {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
  }, [operation, maxAttempts, options]);

  return { data, error, isLoading, retry: execute };
}
