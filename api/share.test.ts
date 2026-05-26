import { describe, expect, it } from 'vitest';
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

describe('GET /api/share (recipe share HTML handler)', () => {
    it('returns 400 when id is missing', async () => {
        const req = {
            method: 'GET',
            query: {},
            headers: { 'x-forwarded-for': '203.0.113.11', host: 'example.test' },
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        await handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(400);
        expect(rr.body).toBe('Missing id');
    });

    it('returns 404 when the recipe id does not exist', async () => {
        const req = {
            method: 'GET',
            query: { id: 'does-not-exist' },
            headers: { 'x-forwarded-for': '203.0.113.12', host: 'example.test' },
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        await handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(404);
        expect(rr.body).toBe('Recipe not found');
    });

    it('returns crawler-friendly Open Graph HTML for a real recipe id', async () => {
        const req = {
            method: 'GET',
            query: { id: sampleRecipe.id },
            headers: {
                'x-forwarded-for': '203.0.113.13',
                'x-forwarded-proto': 'https',
                'x-forwarded-host': 'cookbook.example.test',
            },
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        await handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        const html = rr.body as string;
        expect(rr.statusCode).toBe(200);
        expect(rr.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(rr.headers['cache-control']).toContain('s-maxage=3600');
        expect(html).toContain('<meta property="og:image" content="https://cookbook.example.test/api/og?recipeId=');
        expect(html).toContain(`<meta property="og:url" content="https://cookbook.example.test/share/recipe/${sampleRecipe.id}">`);
        expect(html).toContain(`<meta http-equiv="refresh" content="0; url=https://cookbook.example.test/#recipe/${sampleRecipe.id}">`);
        expect(html).toContain('Schafer Family Cookbook');
    });

    it('escapes recipe text before placing it in HTML metadata', () => {
        const html = renderShareHtml(
            {
                id: 'special id',
                title: 'A <Great> & "Quoted" Recipe',
                contributor: "O'Family & Friends",
            },
            'https://cookbook.example.test'
        );

        expect(html).toContain('A &lt;Great&gt; &amp; &quot;Quoted&quot; Recipe');
        expect(html).toContain('O&#39;Family &amp; Friends');
        expect(html).not.toContain('<Great>');
    });

    it('returns 405 for non-GET methods', async () => {
        const req = {
            method: 'POST',
            query: { id: sampleRecipe.id },
            headers: { 'x-forwarded-for': '203.0.113.14', host: 'example.test' },
        } as unknown as Parameters<typeof handler>[0];
        const res = createMockRes() as unknown as Parameters<typeof handler>[1];

        await handler(req, res);

        const rr = res as unknown as ReturnType<typeof createMockRes>;
        expect(rr.statusCode).toBe(405);
        expect(rr.body).toEqual({ error: 'Method Not Allowed' });
    });
});
