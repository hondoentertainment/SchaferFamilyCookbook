/**
 * Client-side proxy for Gemini/Imagen.
 * Keeps API key server-side; call /api/gemini from the browser.
 */

import type { Recipe } from '../types';

const API_BASE = '/api/gemini';

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

export async function generateImage(recipe: Partial<Recipe>): Promise<string> {
    const { imageBase64 } = await post<{ imageBase64: string }>({ action: 'generateImage', recipe });
    if (!imageBase64) throw new Error('No image returned');
    return imageBase64;
}

export async function magicImport(rawText: string): Promise<Record<string, unknown>> {
    const { json } = await post<{ json: string }>({ action: 'magicImport', rawText });
    return JSON.parse(json || '{}') as Record<string, unknown>;
}
