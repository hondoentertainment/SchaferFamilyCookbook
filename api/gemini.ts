import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import {
    buildLLMPromptText,
    normalizeDescription,
    buildRecipeImagePrompt,
    extractGeneratedImage,
    TEXT_MODEL,
    RECIPE_IMAGE_MODEL,
} from '../shared/recipeImagePrompts.mjs';

const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

type RecipeInput = {
    title?: string;
    category?: string;
    ingredients?: string[];
    instructions?: string[];
};

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err ?? '');
}

function isQuotaError(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('429') || lower.includes('quota') || lower.includes('rate limit');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const action = typeof body.action === 'string' ? body.action : '';

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        if (action === 'generateContent') {
            const text = typeof body.text === 'string' ? body.text : '';
            if (!text) return res.status(400).json({ error: 'Missing text' });
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text }] }]
            });
            const result = (response as any).text;
            return res.status(200).json({ text: result ?? '' });
        }

        if (action === 'generateImage') {
            const recipe = (body.recipe && typeof body.recipe === 'object')
                ? (body.recipe as RecipeInput)
                : undefined;
            if (!recipe?.title) return res.status(400).json({ error: 'Missing recipe' });

            const promptText = buildLLMPromptText(recipe);
            const contentResp = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text: promptText }] }]
            });
            const raw = (contentResp as any).text;
            const description = normalizeDescription(raw, recipe);

            const imageResp = await ai.models.generateContent({
                model: RECIPE_IMAGE_MODEL,
                contents: [{ role: 'user', parts: [{ text: buildRecipeImagePrompt(description) }] }],
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: {
                        aspectRatio: '4:3',
                        imageSize: '1K'
                    }
                }
            });
            const generatedImage = extractGeneratedImage(imageResp);
            if (!generatedImage?.imageBase64) {
                return res.status(500).json({ error: 'Image generation failed' });
            }

            return res.status(200).json({ 
                imageBase64: generatedImage.imageBase64,
                mimeType: generatedImage.mimeType,
                imageSource: 'nano-banana'
            });
        }

        if (action === 'magicImport') {
            const rawText = typeof body.rawText === 'string' ? body.rawText : '';
            if (!rawText) return res.status(400).json({ error: 'Missing rawText' });
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
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
    } catch (err: unknown) {
        console.error('Gemini API error:', err);
        const message = getErrorMessage(err);
        if (isQuotaError(message)) {
            return res.status(429).json({
                error: 'AI quota exceeded for Gemini. Please try again later or upgrade the Gemini API plan.'
            });
        }
        return res.status(500).json({ error: 'Gemini API error' });
    }
}

