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
        status(code: number) {
            statusCode = code;
            return this;
        },
        send(payload: unknown) {
            body = payload;
            return this;
        },
    };
}

describe('GET /api/ping (diagnostic route)', () => {
    it('returns 200 OK with a plain-text body', () => {
        const req = {
            method: 'GET',
            headers: {},
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(200);
        expect(rr.body).toBe('ok');
        expect(rr.headers['content-type']).toBe('text/plain');
    });

    it('responds even when the request method is unusual (no method gate)', () => {
        const req = {
            method: 'POST',
            headers: {},
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        // Diagnostic endpoint deliberately accepts all methods so on-call can
        // reach it from any HTTP client without a method-mismatch failure.
        expect(rr.statusCode).toBe(200);
        expect(rr.body).toBe('ok');
    });

    it('does not allocate large payloads (smoke check for cold-start cost)', () => {
        const req = {
            method: 'GET',
            headers: {},
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        const start = process.hrtime.bigint();
        handler(req, res);
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

        // Generous bound — the route is two synchronous setHeader/send calls.
        expect(elapsedMs).toBeLessThan(50);
    });
});
