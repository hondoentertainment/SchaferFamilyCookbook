import { describe, it, expect } from 'vitest';
import handler from './ping';

function createMockRes() {
    const headers: Record<string, string | number> = {};
    let statusCode = 0;
    let body: unknown = undefined;
    return {
        headers,
        get statusCode() {
            return statusCode;
        },
        get body() {
            return body;
        },
        setHeader(name: string, value: string | number) {
            headers[name.toLowerCase()] = value;
            return this;
        },
        getHeader(name: string) {
            return headers[name.toLowerCase()];
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
        send(payload: unknown) {
            body = payload;
            return this;
        },
        json(payload: unknown) {
            body = payload;
            return this;
        },
        end(payload?: unknown) {
            if (payload !== undefined) body = payload;
            return this;
        },
    };
}

describe('GET /api/ping (serverless diagnostics)', () => {
    it('returns 200 JSON reporting a non-empty bundled recipe seed', () => {
        const req = { method: 'GET', query: {}, headers: {} } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];
        handler(req, res);
        const rr = res as unknown as ReturnType<typeof createMockRes>;

        expect(rr.statusCode).toBe(200);
        expect(rr.headers['content-type']).toBe('application/json');

        const payload = JSON.parse(rr.body as string);
        expect(payload.status).toBe('ok');
        expect(payload.recipeSeedCount).toBeGreaterThan(0);
        expect(typeof payload.time).toBe('string');
        expect(Number.isNaN(Date.parse(payload.time))).toBe(false);
    });
});
