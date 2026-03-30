import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContent, generateImage, magicImport } from './geminiProxy';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: object, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
    };
}

describe('geminiProxy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateContent', () => {
        it('should return generated text', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ text: 'Hello world' }));

            const result = await generateContent('Say hello');

            expect(result).toBe('Hello world');
            expect(mockFetch).toHaveBeenCalledWith('/api/gemini', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ action: 'generateContent', text: 'Say hello' }),
            }));
        });

        it('should return empty string when text is undefined', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ text: undefined }));

            const result = await generateContent('test');

            expect(result).toBe('');
        });

        it('should throw on API error', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ error: 'Rate limited' }, 429));

            await expect(generateContent('test')).rejects.toThrow('Rate limited');
        });

        it('should throw generic error when no error message in response', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.reject(new Error('parse error')),
            });

            await expect(generateContent('test')).rejects.toThrow('API error 500');
        });
    });

    describe('generateImage', () => {
        it('should return image data with nano-banana source', async () => {
            mockFetch.mockResolvedValue(jsonResponse({
                imageBase64: 'abc123',
                mimeType: 'image/png',
                imageSource: 'nano-banana',
            }));

            const result = await generateImage({ title: 'Test Recipe' });

            expect(result.imageBase64).toBe('abc123');
            expect(result.imageSource).toBe('nano-banana');
            expect(result.mimeType).toBe('image/png');
        });

        it('should throw when no image returned', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ imageBase64: '', mimeType: 'image/png' }));

            await expect(generateImage({ title: 'Test' })).rejects.toThrow('No image returned');
        });
    });

    describe('magicImport', () => {
        it('should parse and return recipe JSON', async () => {
            const recipe = { title: 'Cookies', ingredients: ['flour'], instructions: ['mix'] };
            mockFetch.mockResolvedValue(jsonResponse({ json: JSON.stringify(recipe) }));

            const result = await magicImport('Some recipe text');

            expect(result).toEqual(recipe);
        });

        it('should throw on invalid JSON response', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ json: 'not valid json{' }));

            await expect(magicImport('test')).rejects.toThrow('Failed to parse recipe JSON');
        });

        it('should throw on non-object response', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ json: JSON.stringify([1, 2, 3]) }));

            await expect(magicImport('test')).rejects.toThrow('Unexpected response shape');
        });

        it('should handle null json gracefully', async () => {
            mockFetch.mockResolvedValue(jsonResponse({ json: null }));

            const result = await magicImport('test');

            expect(result).toEqual({});
        });
    });
});
