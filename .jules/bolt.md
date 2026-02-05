## 2024-05-23 - [O(N) Lookups in Render Loops]
**Learning:** Performing array searches (like `find`) inside a list rendering loop (e.g., `recipes.map`) causes O(N*M) complexity, where N is recipes and M is contributors. This silently kills performance on large lists.
**Action:** Always pre-compute lookup maps (O(1)) using `useMemo` before rendering lists.
