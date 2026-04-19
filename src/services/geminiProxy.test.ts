import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as geminiProxy from './geminiProxy';

/**
 * Helper: build a mock Response that fetch can return.
 */
function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => body,
    } as unknown as Response;
}

describe('geminiProxy.parseRecipeFromImage', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        // Stub FileReader so File -> base64 works in jsdom/happy-dom without DOM file APIs flaking.
        class StubFileReader {
            public result: string | ArrayBuffer | null = null;
            public error: unknown = null;
            public onload: (() => void) | null = null;
            public onerror: (() => void) | null = null;
            readAsDataURL(_file: Blob) {
                this.result = 'data:image/jpeg;base64,QUJD'; // "ABC"
                queueMicrotask(() => this.onload?.());
            }
        }
        // @ts-expect-error: override
        globalThis.FileReader = StubFileReader;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    function makeImageFile(sizeBytes: number, type = 'image/jpeg'): File {
        // Build a Blob of the requested size cheaply.
        const data = new Uint8Array(Math.min(sizeBytes, 1024)); // small payload
        const file = new File([data], 'card.jpg', { type });
        // Override size for the over-limit test without allocating huge buffers.
        Object.defineProperty(file, 'size', { value: sizeBytes });
        return file;
    }

    it('parses a well-formed Gemini JSON response into a Partial<Recipe>', async () => {
        const json = JSON.stringify({
            title: 'Grandma Schafer Apple Pie',
            category: 'Dessert',
            contributor: 'Grandma Schafer',
            ingredients: ['6 apples', '1 cup sugar', '1 pie crust'],
            instructions: ['Peel apples', 'Mix with sugar', 'Bake at 375°F for 45 min'],
            prepTime: '20 min',
            cookTime: '45 min',
            calories: 320,
            notes: 'From the 1972 family cookbook.',
        });
        const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ json }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const file = makeImageFile(1024);
        const result = await geminiProxy.parseRecipeFromImage(file);

        expect(result.title).toBe('Grandma Schafer Apple Pie');
        expect(result.category).toBe('Dessert');
        expect(result.contributor).toBe('Grandma Schafer');
        expect(result.ingredients).toHaveLength(3);
        expect(result.instructions).toHaveLength(3);
        expect(result.prepTime).toBe('20 min');
        expect(result.cookTime).toBe('45 min');
        expect(result.calories).toBe(320);
        expect(result.notes).toContain('1972');

        // Verify the call shape: action + base64 + mimeType
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0];
        const body = JSON.parse(init.body as string);
        expect(body.action).toBe('parseRecipeFromImage');
        expect(body.mimeType).toBe('image/jpeg');
        expect(typeof body.imageBase64).toBe('string');
        expect(body.imageBase64.length).toBeGreaterThan(0);
    });

    it('strips Markdown fences from the response before parsing', async () => {
        const fenced = '```json\n' + JSON.stringify({
            title: 'Banana Bread',
            ingredients: ['2 bananas', 'flour'],
            instructions: ['mix', 'bake'],
        }) + '\n```';
        globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ json: fenced })) as unknown as typeof fetch;

        const result = await geminiProxy.parseRecipeFromImage(makeImageFile(1024));
        expect(result.title).toBe('Banana Bread');
        expect(result.ingredients).toEqual(['2 bananas', 'flour']);
    });

    it('throws on malformed JSON from the server', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ json: 'not-json{{{' })) as unknown as typeof fetch;
        await expect(geminiProxy.parseRecipeFromImage(makeImageFile(1024)))
            .rejects.toThrow(/Failed to parse recipe JSON/);
    });

    it('throws when the response shape is empty (no title/ingredients/instructions)', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ json: '{}' })) as unknown as typeof fetch;
        await expect(geminiProxy.parseRecipeFromImage(makeImageFile(1024)))
            .rejects.toThrow(/Could not read a recipe/);
    });

    it('rejects images larger than 10 MB without making a network call', async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        const big = makeImageFile(11 * 1024 * 1024);

        await expect(geminiProxy.parseRecipeFromImage(big)).rejects.toThrow(/under 10 MB/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects non-image files', async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        await expect(geminiProxy.parseRecipeFromImage(txt)).rejects.toThrow(/must be an image/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces server error messages on non-OK responses', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockJsonResponse({ error: 'Image too large.' }, false, 413)
        ) as unknown as typeof fetch;
        await expect(geminiProxy.parseRecipeFromImage(makeImageFile(1024)))
            .rejects.toThrow(/Image too large/);
    });

    it('exposes RECIPE_OCR_MAX_BYTES = 10 MB', () => {
        expect(geminiProxy.RECIPE_OCR_MAX_BYTES).toBe(10 * 1024 * 1024);
    });
});

describe('geminiProxy.magicImport (regression: existing flow unchanged)', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('still parses a JSON object from the magicImport endpoint', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockJsonResponse({ json: JSON.stringify({ title: 'Soup', ingredients: ['water'] }) })
        ) as unknown as typeof fetch;

        const result = await geminiProxy.magicImport('soup of the day: water');
        expect(result.title).toBe('Soup');
    });
});
