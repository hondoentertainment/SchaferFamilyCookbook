/**
 * Client-side proxy for Gemini/Imagen.
 * Keeps API key server-side; call /api/gemini from the browser.
 */

import type { Recipe } from '../types';

const API_BASE = '/api/gemini';

export type GeneratedRecipeImage = {
    imageBase64: string;
    mimeType?: string;
    imageSource: 'nano-banana';
};

async function post<T>(body: object): Promise<T> {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `API error ${res.status}`);
    }
    return res.json();
}

export async function generateContent(text: string): Promise<string> {
    const { text: result } = await post<{ text: string }>({ action: 'generateContent', text });
    return result ?? '';
}

export async function generateImage(recipe: Partial<Recipe>): Promise<GeneratedRecipeImage> {
    const result = await post<GeneratedRecipeImage>({ action: 'generateImage', recipe });
    const { imageBase64 } = result;
    if (!imageBase64) throw new Error('No image returned');
    return { imageSource: 'nano-banana', ...result };
}

export async function magicImport(rawText: string): Promise<Record<string, unknown>> {
    const { json } = await post<{ json: string }>({ action: 'magicImport', rawText });
    let parsed: unknown;
    try {
        parsed = JSON.parse(json || '{}');
    } catch {
        throw new Error('Failed to parse recipe JSON from server response');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Unexpected response shape: expected a JSON object');
    }
    return parsed as Record<string, unknown>;
}

/** Maximum image size accepted client-side before sending to /api/gemini (10 MB raw). */
export const RECIPE_OCR_MAX_BYTES = 10 * 1024 * 1024;

/** Read a File as raw base64 (without the data: URL prefix). */
async function fileToBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Unexpected FileReader result'));
                return;
            }
            // strip "data:<mime>;base64," prefix
            const idx = result.indexOf('base64,');
            resolve(idx >= 0 ? result.slice(idx + 'base64,'.length) : result);
        };
        reader.readAsDataURL(file);
    });
}

/** Strip leading/trailing markdown code fences (```json ... ```) if Gemini ignored the JSON-only instruction. */
function stripMarkdownFences(text: string): string {
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) return trimmed;
    return trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}

/**
 * OCR a photo of a recipe card or cookbook page using Gemini Vision and return a partial Recipe.
 * Caller should merge the result into the recipe form.
 */
export async function parseRecipeFromImage(file: File): Promise<Partial<Recipe>> {
    if (!file) throw new Error('No image file provided');
    if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image (JPEG, PNG, WebP, or HEIC).');
    }
    if (file.size > RECIPE_OCR_MAX_BYTES) {
        throw new Error('Image must be under 10 MB. Try a smaller photo.');
    }

    const imageBase64 = await fileToBase64(file);
    const { json } = await post<{ json: string }>({
        action: 'parseRecipeFromImage',
        imageBase64,
        mimeType: file.type || 'image/jpeg',
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(stripMarkdownFences(json || '{}'));
    } catch {
        throw new Error('Failed to parse recipe JSON from server response');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Unexpected response shape: expected a JSON object');
    }

    const obj = parsed as Record<string, unknown>;
    const result: Partial<Recipe> = {};
    if (typeof obj.title === 'string' && obj.title.trim()) result.title = obj.title.trim();
    if (typeof obj.category === 'string' && obj.category.trim()) {
        result.category = obj.category.trim() as Recipe['category'];
    }
    if (typeof obj.contributor === 'string' && obj.contributor.trim()) {
        result.contributor = obj.contributor.trim();
    }
    if (Array.isArray(obj.ingredients)) {
        result.ingredients = obj.ingredients.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
    if (Array.isArray(obj.instructions)) {
        result.instructions = obj.instructions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
    if (typeof obj.prepTime === 'string' && obj.prepTime.trim()) result.prepTime = obj.prepTime.trim();
    if (typeof obj.cookTime === 'string' && obj.cookTime.trim()) result.cookTime = obj.cookTime.trim();
    if (typeof obj.calories === 'number' && Number.isFinite(obj.calories)) result.calories = obj.calories;
    if (typeof obj.notes === 'string' && obj.notes.trim()) result.notes = obj.notes.trim();

    // Defensive: a useful OCR result should at least have a title or some ingredients/instructions.
    if (!result.title && !(result.ingredients?.length) && !(result.instructions?.length)) {
        throw new Error('Could not read a recipe from this photo. Try a clearer image with better lighting.');
    }

    return result;
}
