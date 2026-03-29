import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounceAction } from './useDebounceAction';

describe('useDebounceAction', () => {
    it('executes action on first call', async () => {
        const action = vi.fn().mockResolvedValue('done');

        const { result } = renderHook(() => useDebounceAction(action));

        await act(async () => {
            await result.current('arg1');
        });

        expect(action).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledWith('arg1');
    });

    it('ignores concurrent calls while in-flight', async () => {
        let resolveAction: () => void;
        const action = vi.fn(() => new Promise<void>((r) => { resolveAction = r; }));

        const { result } = renderHook(() => useDebounceAction(action));

        // Start first call (will be in-flight)
        let firstCallPromise: Promise<any>;
        act(() => {
            firstCallPromise = result.current();
        });

        // Try second call while first is in-flight
        await act(async () => {
            await result.current();
        });

        // Only one call should have gone through
        expect(action).toHaveBeenCalledTimes(1);

        // Resolve the first call
        await act(async () => {
            resolveAction!();
            await firstCallPromise!;
        });

        // Now a new call should work
        const action2 = vi.fn().mockResolvedValue('ok');
        const { result: result2 } = renderHook(() => useDebounceAction(action2));

        await act(async () => {
            await result2.current();
        });

        expect(action2).toHaveBeenCalledTimes(1);
    });

    it('allows new calls after previous completes', async () => {
        const action = vi.fn().mockResolvedValue('done');

        const { result } = renderHook(() => useDebounceAction(action));

        await act(async () => {
            await result.current();
        });

        await act(async () => {
            await result.current();
        });

        expect(action).toHaveBeenCalledTimes(2);
    });

    it('resets in-flight state even if action throws', async () => {
        const action = vi.fn()
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce('ok');

        const { result } = renderHook(() => useDebounceAction(action));

        // First call throws
        await act(async () => {
            try {
                await result.current();
            } catch {
                // expected
            }
        });

        // Second call should still work because finally block reset inFlight
        await act(async () => {
            await result.current();
        });

        expect(action).toHaveBeenCalledTimes(2);
    });
});
