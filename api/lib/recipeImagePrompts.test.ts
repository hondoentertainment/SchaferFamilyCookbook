import { describe, it, expect } from 'vitest';
import {
    TEXT_MODEL,
    RECIPE_IMAGE_MODEL,
    buildLLMPromptText,
    normalizeDescription,
    buildRecipeImagePrompt,
    extractGeneratedImage,
} from './recipeImagePrompts';

describe('recipeImagePrompts re-export', () => {
    it('exports canonical model ids', () => {
        expect(TEXT_MODEL).toBeTruthy();
        expect(RECIPE_IMAGE_MODEL).toBeTruthy();
    });

    it('builds LLM prompt text from recipe fields', () => {
        const text = buildLLMPromptText({
            title: 'Apple Pie',
            category: 'Dessert',
            ingredients: ['apples', 'sugar'],
            instructions: ['Bake'],
        });
        expect(text).toContain('Apple Pie');
        expect(text).toContain('apples');
    });

    it('normalizes short LLM output with deterministic fallback', () => {
        const description = normalizeDescription('ok', {
            title: 'Toast',
            ingredients: ['bread'],
        });
        expect(description.length).toBeGreaterThan(10);
    });

    it('builds image prompt and extracts base64 payload shape', () => {
        const prompt = buildRecipeImagePrompt('Golden toast on a plate');
        expect(prompt).toContain('Golden toast');

        const image = extractGeneratedImage({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'abc123',
                                },
                            },
                        ],
                    },
                },
            ],
        });
        expect(image).toEqual({ imageBase64: 'abc123', mimeType: 'image/png' });
    });
});
