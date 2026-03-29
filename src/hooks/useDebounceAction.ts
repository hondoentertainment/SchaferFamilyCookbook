import { useRef, useCallback } from 'react';

/**
 * Prevents duplicate rapid-fire actions (double-click protection).
 * Returns a wrapped callback that ignores calls while the previous is in-flight.
 */
export function useDebounceAction<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  const inFlight = useRef(false);

  return useCallback(
    (async (...args: any[]) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        return await action(...args);
      } finally {
        inFlight.current = false;
      }
    }) as any,
    [action]
  ) as T;
}
