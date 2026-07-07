import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<unknown> } };

function stubWakeLock() {
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }) as unknown as WakeLockSentinel);
    (navigator as WakeLockNavigator).wakeLock = { request };
    return { request, release };
}

describe('useWakeLock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        delete (navigator as WakeLockNavigator).wakeLock;
    });

    it('requests a screen wake lock when active', async () => {
        const { request } = stubWakeLock();
        renderHook(() => useWakeLock(true));
        await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not request a wake lock when inactive', async () => {
        const { request } = stubWakeLock();
        renderHook(() => useWakeLock(false));
        await Promise.resolve();
        expect(request).not.toHaveBeenCalled();
    });

    it('releases the lock on unmount', async () => {
        const { request, release } = stubWakeLock();
        const { unmount } = renderHook(() => useWakeLock(true));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
        unmount();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('re-requests the lock when the page becomes visible again', async () => {
        const { request } = stubWakeLock();
        renderHook(() => useWakeLock(true));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
        // Browser auto-releases when hidden; on return to visible we reacquire.
        document.dispatchEvent(new Event('visibilitychange'));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    });

    it('stops listening for visibility changes after unmount', async () => {
        const { request } = stubWakeLock();
        const { unmount } = renderHook(() => useWakeLock(true));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
        unmount();
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('invokes onUnavailable once when the request is rejected', async () => {
        const request = vi.fn(async () => {
            throw new Error('denied');
        });
        (navigator as WakeLockNavigator).wakeLock = { request };
        const onUnavailable = vi.fn();
        renderHook(() => useWakeLock(true, onUnavailable));
        await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
        // A failing re-request on visibility return should not re-notify.
        document.dispatchEvent(new Event('visibilitychange'));
        await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        expect(onUnavailable).toHaveBeenCalledTimes(1);
    });
});
