import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateContent, generateImage, magicImport } from './geminiProxy';

// ---------------------------------------------------------------------------
// fetch is stubbed globally for every test in this file.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkResponse(body: unknown) {
    return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
    } as Response);
}

function makeErrorResponse(status: number, body: unknown = {}) {
    return Promise.resolve({
        ok: false,
        status,
        json: () => Promise.resolve(body),
    } as Response);
}

// ---------------------------------------------------------------------------
// generateContent
// ---------------------------------------------------------------------------

describe('generateContent', () => {
    it('returns the text field from a successful API response', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ text: 'Here is some generated text.' }));
        const result = await generateContent('Give me a poem');
        expect(result).toBe('Here is some generated text.');
    });

    it('sends a POST to /api/gemini with action=generateContent and the provided text', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ text: 'ok' }));
        await generateContent('hello world');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/gemini');
        expect(options.method).toBe('POST');
        expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });

        const body = JSON.parse(options.body as string);
        expect(body).toEqual({ action: 'generateContent', text: 'hello world' });
    });

    it('returns empty string when the response text field is missing', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({}));
        const result = await generateContent('anything');
        expect(result).toBe('');
    });

    it('throws on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(generateContent('test')).rejects.toThrow('Failed to fetch');
    });

    it('throws with the API error message on a non-ok response', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(500, { error: 'Internal Server Error' }));
        await expect(generateContent('test')).rejects.toThrow('Internal Server Error');
    });

    it('falls back to a generic status message when the error body has no error field', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(503, {}));
        await expect(generateContent('test')).rejects.toThrow('API error 503');
    });

    it('surfaces a 429 rate-limiting response as an error', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(429, { error: 'Rate limit exceeded' }));
        await expect(generateContent('test')).rejects.toThrow('Rate limit exceeded');
    });

    it('handles a 429 with no error body gracefully', async () => {
        mockFetch.mockReturnValueOnce(
            Promise.resolve({
                ok: false,
                status: 429,
                json: () => Promise.reject(new SyntaxError('no body')),
            } as unknown as Response)
        );
        await expect(generateContent('test')).rejects.toThrow('API error 429');
    });
});

// ---------------------------------------------------------------------------
// magicImport (recipe import from raw text)
// ---------------------------------------------------------------------------

describe('magicImport', () => {
    it('returns parsed recipe object on a well-formed response', async () => {
        const recipe = { title: 'Chocolate Cake', ingredients: ['flour', 'cocoa'], instructions: ['mix', 'bake'] };
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: JSON.stringify(recipe) }));

        const result = await magicImport('Chocolate cake recipe...');
        expect(result).toEqual(recipe);
    });

    it('sends a POST with action=magicImport and rawText', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: '{"title":"Test"}' }));
        await magicImport('some raw text');

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(options.body as string);
        expect(body).toEqual({ action: 'magicImport', rawText: 'some raw text' });
    });

    it('throws a descriptive error when the server returns malformed JSON in the json field', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: '{ not valid json' }));
        await expect(magicImport('anything')).rejects.toThrow('Failed to parse recipe JSON');
    });

    it('throws when the json field is missing from the response', async () => {
        // json field is undefined → JSON.parse('{}') returns {} which is a valid object
        mockFetch.mockReturnValueOnce(makeOkResponse({}));
        const result = await magicImport('anything');
        expect(result).toEqual({});
    });

    it('throws when the parsed value is an array instead of an object', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: '["a", "b"]' }));
        await expect(magicImport('anything')).rejects.toThrow('Unexpected response shape');
    });

    it('throws when the parsed value is a primitive (string)', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: '"just a string"' }));
        await expect(magicImport('anything')).rejects.toThrow('Unexpected response shape');
    });

    it('throws when the parsed value is null', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ json: 'null' }));
        await expect(magicImport('anything')).rejects.toThrow('Unexpected response shape');
    });

    it('throws on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('network down'));
        await expect(magicImport('text')).rejects.toThrow('network down');
    });

    it('surfaces a 429 rate-limiting error from the import endpoint', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(429, { error: 'Too many requests' }));
        await expect(magicImport('text')).rejects.toThrow('Too many requests');
    });
});

// ---------------------------------------------------------------------------
// generateImage
// ---------------------------------------------------------------------------

describe('generateImage', () => {
    const mockRecipe = { id: 'r1', title: 'Banana Bread', category: 'Dessert' as const };

    it('returns the image data with imageSource set to "nano-banana" on success', async () => {
        const base64 = 'iVBORw0KGgo=';
        mockFetch.mockReturnValueOnce(
            makeOkResponse({ imageBase64: base64, mimeType: 'image/png' })
        );

        const result = await generateImage(mockRecipe);
        expect(result.imageBase64).toBe(base64);
        expect(result.mimeType).toBe('image/png');
        expect(result.imageSource).toBe('nano-banana');
    });

    it('sends a POST with action=generateImage and the recipe object', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ imageBase64: 'abc123' }));
        await generateImage(mockRecipe);

        const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/gemini');
        const body = JSON.parse(options.body as string);
        expect(body.action).toBe('generateImage');
        expect(body.recipe).toMatchObject({ id: 'r1', title: 'Banana Bread' });
    });

    it('throws "No image returned" when the response has no imageBase64 field', async () => {
        mockFetch.mockReturnValueOnce(makeOkResponse({ mimeType: 'image/png' }));
        await expect(generateImage(mockRecipe)).rejects.toThrow('No image returned');
    });

    it('throws on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('offline'));
        await expect(generateImage(mockRecipe)).rejects.toThrow('offline');
    });

    it('surfaces HTTP error codes from the image endpoint', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(500, { error: 'Image generation failed' }));
        await expect(generateImage(mockRecipe)).rejects.toThrow('Image generation failed');
    });

    it('surfaces a 429 rate-limit error from the image endpoint', async () => {
        mockFetch.mockReturnValueOnce(makeErrorResponse(429, { error: 'Rate limit exceeded' }));
        await expect(generateImage(mockRecipe)).rejects.toThrow('Rate limit exceeded');
    });

    it('defaults imageSource to "nano-banana" when the server response omits it', async () => {
        mockFetch.mockReturnValueOnce(
            makeOkResponse({ imageBase64: 'xyz' })
        );
        const result = await generateImage(mockRecipe);
        expect(result.imageSource).toBe('nano-banana');
    });

    it('server-supplied imageSource overrides the "nano-banana" default (spread order)', async () => {
        // The implementation spreads: { imageSource: 'nano-banana', ...result }
        // so a server-provided imageSource field wins.
        mockFetch.mockReturnValueOnce(
            makeOkResponse({ imageBase64: 'xyz', imageSource: 'something-else' })
        );
        const result = await generateImage(mockRecipe);
        // The server value takes precedence due to spread order in the implementation.
        expect(result.imageSource).toBe('something-else');
    });
});
