import { describe, it, expect } from 'vitest';
import handler, { renderShareHtml } from './share';
import recipesJson from '../src/data/recipes.json' with { type: 'json' };

type RecipeLike = { id: string; title: string; contributor: string; image?: string };

const sampleRecipe = (recipesJson as RecipeLike[])[0];

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

function makeReq(query: Record<string, string>, ip: string) {
    return {
        method: 'GET',
        query,
        headers: { 'x-forwarded-for': ip, host: 'example.com', 'x-forwarded-proto': 'https' },
    } as unknown as Parameters<typeof handler>[0];
}

describe('renderShareHtml', () => {
    it('embeds Open Graph + Twitter tags pointing at the OG image route', () => {
        const html = renderShareHtml(
            { id: 'abc', title: 'Plum Cake', contributor: 'Grandma' },
            'https://example.com',
        );
        expect(html).toContain('og:image');
        expect(html).toContain('/api/og?recipeId=abc');
        expect(html).toContain('twitter:card');
        expect(html).toContain('Plum Cake');
    });

    it('escapes HTML-significant characters in recipe fields', () => {
        const html = renderShareHtml(
            { id: 'x', title: '<script>"&', contributor: 'Tester' },
            'https://example.com',
        );
        expect(html).not.toContain('<script>"&');
        expect(html).toContain('&lt;script&gt;');
    });
});

describe('GET /api/share (share landing page handler)', () => {
    it('returns 200 text/html with OG markup for a real recipe id', async () => {
        const req = makeReq({ id: sampleRecipe.id }, '203.0.113.10');
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];
        await handler(req, res);
        const rr = res as unknown as ReturnType<typeof createMockRes>;

        expect(rr.statusCode).toBe(200);
        expect(String(rr.headers['content-type'])).toContain('text/html');
        const html = rr.body as string;
        expect(html).toContain('og:image');
        expect(html).toContain(`/api/og?recipeId=${encodeURIComponent(sampleRecipe.id)}`);
    });

    it('returns 400 when the id is missing', async () => {
        const req = makeReq({}, '203.0.113.11');
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];
        await handler(req, res);
        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(400);
    });

    it('returns 404 when the recipe id does not exist', async () => {
        const req = makeReq({ id: 'does-not-exist' }, '203.0.113.12');
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];
        await handler(req, res);
        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(404);
    });

    it('returns 405 for non-GET methods', async () => {
        const req = makeReq({ id: sampleRecipe.id }, '203.0.113.13');
        (req as { method: string }).method = 'POST';
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];
        await handler(req, res);
        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(405);
    });
});
