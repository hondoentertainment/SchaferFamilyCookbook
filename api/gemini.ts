import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import {
    buildLLMPromptText,
    normalizeDescription,
    buildImagenPrompt,
} from '../shared/recipeImagePrompts.mjs';

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    try {
        const body = req.body as { action: string; [k: string]: unknown };
        const { action } = body;

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        if (action === 'generateContent') {
            const { text } = body as { text: string };
            if (!text) return res.status(400).json({ error: 'Missing text' });
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text }] }]
            });
            const result = (response as any).text;
            return res.status(200).json({ text: result ?? '' });
        }

        if (action === 'generateImage') {
            const { recipe } = body as { recipe: { title?: string; category?: string; ingredients?: string[]; instructions?: string[] } };
            if (!recipe?.title) return res.status(400).json({ error: 'Missing recipe' });

            const promptText = buildLLMPromptText(recipe);
            const contentResp = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: promptText }] }]
            });
            const raw = (contentResp as any).text;
            const description = normalizeDescription(raw, recipe);

            const imageResp = await ai.models.generateImages({
                model: 'imagen-3.0-generate-002',
                prompt: buildImagenPrompt(description),
                config: { numberOfImages: 1 }
            });
            const imageBytes = (imageResp as any).generatedImages?.[0]?.image?.imageBytes;
            if (!imageBytes) return res.status(500).json({ error: 'Image generation failed' });

            return res.status(200).json({ imageBase64: imageBytes });
        }

        if (action === 'magicImport') {
            const { rawText } = body as { rawText: string };
            if (!rawText) return res.status(400).json({ error: 'Missing rawText' });
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: `Recipe text: ${rawText}` }] }],
                config: {
                    systemInstruction: 'Analyze this recipe and extract structured JSON data. Fields: title, category (Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip/Sauce|Snack), ingredients (list), instructions (list), prepTime, cookTime, calories (number - estimated total).',
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            title: { type: 'STRING' },
                            category: { type: 'STRING' },
                            ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
                            instructions: { type: 'ARRAY', items: { type: 'STRING' } },
                            prepTime: { type: 'STRING' },
                            cookTime: { type: 'STRING' },
                            calories: { type: 'NUMBER' }
                        }
                    }
                }
            });
            const result = (response as any).text;
            return res.status(200).json({ json: result ?? '{}' });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
        console.error('Gemini API error:', err);
        return res.status(500).json({ error: err?.message || 'Gemini API error' });
    }
}
