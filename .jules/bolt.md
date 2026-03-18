## 2024-05-23 - Inline Components Performance
**Learning:** `App.tsx` contains several large inline component maps (like recipes grid) that cause unnecessary re-renders of all items when parent state changes. Extracting these to memoized components (e.g., `RecipeCard`) provides significant performance stability.
**Action:** Look for other inline maps (Gallery, Contributors) to extract and memoize in future sessions.
