import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GalleryItem } from '../types';
import { notifyGalleryApproved } from './galleryApproveNotify';

const mockFetch = vi.fn();

const sampleItem: GalleryItem = {
    id: 'g1',
    contributor: 'Dawn',
    caption: 'Family picnic',
    url: 'https://example.com/photo.jpg',
    type: 'image',
    status: 'approved',
};

describe('notifyGalleryApproved', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({ ok: true, status: 200 });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('no-ops when VITE_NOTIFY_SECRET is unset', async () => {
        vi.stubEnv('VITE_NOTIFY_SECRET', '');
        await notifyGalleryApproved(sampleItem);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POSTs to /api/notify with title, body, and contributor', async () => {
        vi.stubEnv('VITE_NOTIFY_SECRET', 'test-secret');
        await notifyGalleryApproved(sampleItem);

        expect(mockFetch).toHaveBeenCalledOnce();
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/notify');
        expect(init.method).toBe('POST');
        expect(init.headers).toMatchObject({
            'Content-Type': 'application/json',
            'x-notify-secret': 'test-secret',
        });
        const body = JSON.parse(String(init.body));
        expect(body.title).toBe('Your photo is live!');
        expect(body.body).toContain('Family picnic');
        expect(body.userName).toBe('Dawn');
    });

    it('uses fallback caption when item caption is empty', async () => {
        vi.stubEnv('VITE_NOTIFY_SECRET', 'test-secret');
        await notifyGalleryApproved({ ...sampleItem, caption: '   ' });

        const body = JSON.parse(String(mockFetch.mock.calls[0]![1]!.body));
        expect(body.body).toContain('Your memory');
    });

    it('logs warning when notify returns non-OK status', async () => {
        vi.stubEnv('VITE_NOTIFY_SECRET', 'test-secret');
        mockFetch.mockResolvedValue({ ok: false, status: 500 });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await notifyGalleryApproved(sampleItem);

        expect(warn).toHaveBeenCalledWith('Gallery approve notify failed:', 500);
        warn.mockRestore();
    });

    it('logs warning when fetch throws', async () => {
        vi.stubEnv('VITE_NOTIFY_SECRET', 'test-secret');
        mockFetch.mockRejectedValue(new Error('network'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await notifyGalleryApproved(sampleItem);

        expect(warn).toHaveBeenCalledWith('Gallery approve notify error:', expect.any(Error));
        warn.mockRestore();
    });
});
