## 2024-05-22 - Memoization and Callbacks
**Learning:** When extracting components to optimize re-renders with `React.memo`, ensure that callback props (like `onClick`) are stable.
**Action:** Always wrap event handlers passed to memoized components in `useCallback` to prevent breaking memoization on parent re-renders.
