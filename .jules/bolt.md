## 2024-05-23 - React List Optimization
**Learning:** In React applications with large lists, keeping list item rendering inside the main component prevents `React.memo` optimizations. Extracting list items to a separate component wrapped in `React.memo` and ensuring all props (especially functions) are stable via `useCallback` is critical for preventing unnecessary re-renders of the entire list when unrelated state changes.
**Action:** When optimizing list performance, always extract the item into a standalone memoized component and audit prop stability.
