import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getRememberedServings, setRememberedServings } from './recipeServingsMemory';

describe('recipeServingsMemory', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns fallback when nothing is stored', () => {
        expect(getRememberedServings('r1', 4)).toBe(4);
    });

    it('persists and restores servings per recipe', () => {
        setRememberedServings('r1', 6);
        expect(getRememberedServings('r1', 4)).toBe(6);
        expect(getRememberedServings('r2', 4)).toBe(4);
    });
});
