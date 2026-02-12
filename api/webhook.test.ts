import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('twilio', () => ({
    default: {
        twiml: {
            MessagingResponse: class MockMessagingResponse {
                message = vi.fn();
                toString = () => '<Response></Response>';
            }
        }
    }
}));

vi.mock('firebase-admin', () => ({
    default: {
        apps: { length: 0 },
        initializeApp: vi.fn(),
        firestore: vi.fn(() => ({
            collection: vi.fn(() => ({
                where: vi.fn(() => ({
                    get: vi.fn(() => ({ empty: true, docs: [] }))
                })),
                doc: vi.fn(() => ({
                    set: vi.fn()
                }))
            }))
        })),
        storage: vi.fn(() => ({
            bucket: vi.fn(() => ({
                file: vi.fn(() => ({
                    save: vi.fn(),
                    makePublic: vi.fn()
                }))
            }))
        }))
    }
}));

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    headers: { get: () => 'image/jpeg' }
})));

describe('webhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 405 for non-POST', async () => {
        const handler = (await import('./webhook')).default;
        const res = { status: vi.fn(() => res), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
        await handler({ method: 'GET' } as any, res as any);
        expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should return 200 with TwiML when no media', async () => {
        const handler = (await import('./webhook')).default;
        const res = { status: vi.fn(() => res), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
        await handler({
            method: 'POST',
            body: { From: '+15551234567', NumMedia: '0', Body: 'test' }
        } as any, res as any);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
        expect(res.send).toHaveBeenCalled();
    });
});
