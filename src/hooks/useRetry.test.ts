import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetry } from './useRetry';

describe('useRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns loading state during operation', async () => {
        let resolveOp: (v: string) => void;
        const operation = vi.fn(() => new Promise<string>((r) => { resolveOp = r; }));

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 1 }));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();

        // Start the operation
        act(() => {
            result.current.retry();
        });

        expect(result.current.isLoading).toBe(true);

        // Resolve
        await act(async () => {
            resolveOp!('done');
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('returns data on success', async () => {
        const operation = vi.fn().mockResolvedValue('result-data');

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 1 }));

        await act(async () => {
            result.current.retry();
        });

        expect(result.current.data).toBe('result-data');
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('returns error after max retries', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('fail'));

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 1 }));

        await act(async () => {
            result.current.retry();
        });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('fail');
        expect(result.current.data).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('retries on failure before giving up', async () => {
        const operation = vi.fn()
            .mockRejectedValueOnce(new Error('fail1'))
            .mockResolvedValueOnce('success');

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 2 }));

        await act(async () => {
            const retryPromise = result.current.retry();
            // Advance past the exponential backoff timer (1000ms * 2^0 = 1000ms)
            await vi.advanceTimersByTimeAsync(1500);
            await retryPromise;
        });

        expect(operation).toHaveBeenCalledTimes(2);
        expect(result.current.data).toBe('success');
        expect(result.current.error).toBeNull();
    });

    it('retry function re-executes after error', async () => {
        const operation = vi.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce('recovered');

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 1 }));

        // First call fails
        await act(async () => {
            result.current.retry();
        });

        expect(result.current.error?.message).toBe('fail');

        // Second manual retry succeeds
        await act(async () => {
            result.current.retry();
        });

        expect(result.current.data).toBe('recovered');
        expect(result.current.error).toBeNull();
    });

    it('calls onSuccess callback on success', async () => {
        const onSuccess = vi.fn();
        const operation = vi.fn().mockResolvedValue('data');

        const { result } = renderHook(() => useRetry(operation, { maxAttempts: 1, onSuccess }));

        await act(async () => {
            result.current.retry();
        });

        expect(onSuccess).toHaveBeenCalledWith('data');
    });
});
