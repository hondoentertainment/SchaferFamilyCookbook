## 2024-05-22 - [Optimizing List Rendering]
**Learning:** Extracting inline list items to memoized components significantly reduces re-renders when parent state changes. Specifically, `RecipeCard` was extracted from `App.tsx` and wrapped in `React.memo`.
**Action:** Always extract complex list items into separate memoized components, especially in large parent components like `App.tsx` that manage global state.
