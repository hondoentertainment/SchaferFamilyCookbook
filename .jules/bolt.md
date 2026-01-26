## 2024-05-22 - Stabilizing Callbacks via Scope Hoisting
**Learning:** Moving helper functions (that don't rely on component state) outside the React component scope allows them to be naturally stable. This simplifies `useCallback` dependency arrays for event handlers that call them, avoiding the need to wrap the helpers themselves in `useCallback`.
**Action:** Identify helper functions defined inside components that only use arguments or global/module constants, and hoist them to module scope.
