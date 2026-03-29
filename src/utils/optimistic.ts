/**
 * Wraps a state setter + async operation for optimistic updates.
 * Immediately applies the optimistic value, then rolls back on failure.
 */
export async function optimisticUpdate<T>(
  currentValue: T,
  optimisticValue: T,
  setter: (value: T) => void,
  asyncOperation: () => Promise<void>,
  onError?: (error: Error) => void
): Promise<boolean> {
  setter(optimisticValue);
  try {
    await asyncOperation();
    return true;
  } catch (err) {
    setter(currentValue); // rollback
    if (onError) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return false;
  }
}
