import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getClientIp, slidingWindowAllow, GEMINI_RATE_LIMIT } from './lib/rateLimit';
import {
    buildLLMPromptText,
    normalizeDescription,
    buildRecipeImagePrompt,
    buildPollinationsImageUrl,
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

function getResponseText(response: { text?: string } | null | undefined): string {
    return typeof response?.text === 'string' ? response.text : '';
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err ?? '');
}

function isQuotaError(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('429') || lower.includes('quota') || lower.includes('rate limit');
}

async function fetchPollinationsImage(recipe: RecipeInput) {
    const imageUrl = buildPollinationsImageUrl(recipe);
    const response = await fetch(imageUrl, {
        headers: { 'User-Agent': 'SchaferCookbook/1.0' },
        signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
        throw new Error(`Pollinations image request failed with HTTP ${response.status}`);
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    if (imageBuffer.length < 1000) {
        throw new Error(`Pollinations image response was too small (${imageBuffer.length} bytes)`);
    }
    return {
        imageBase64: imageBuffer.toString('base64'),
        mimeType,
        imageSource: 'pollinations' as const,
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (process.env.GEMINI_RATE_LIMIT_DISABLED !== '1') {
        const ip = getClientIp(req);
        if (!slidingWindowAllow(`gemini:${ip}`, GEMINI_RATE_LIMIT.max, GEMINI_RATE_LIMIT.windowMs)) {
            return res.status(429).json({
                error: 'Too many requests. Please wait a minute and try again.',
            });
        }
    }

    try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const action = typeof body.action === 'string' ? body.action : '';

        if (action === 'generateContent') {
            if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
            const text = typeof body.text === 'string' ? body.text : '';
            if (!text) return res.status(400).json({ error: 'Missing text' });
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text }] }]
            });
            const result = getResponseText(response);
            return res.status(200).json({ text: result ?? '' });
        }

        if (action === 'generateImage') {
            const recipe = (body.recipe && typeof body.recipe === 'object')
                ? (body.recipe as RecipeInput)
                : undefined;
            if (!recipe?.title) return res.status(400).json({ error: 'Missing recipe' });

            if (API_KEY) {
                try {
                    const ai = new GoogleGenAI({ apiKey: API_KEY });
                    const promptText = buildLLMPromptText(recipe);
                    const contentResp = await ai.models.generateContent({
                        model: TEXT_MODEL,
                        contents: [{ role: 'user', parts: [{ text: promptText }] }]
                    });
                    const raw = getResponseText(contentResp);
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
                    if (generatedImage?.imageBase64) {
                        return res.status(200).json({
                            imageBase64: generatedImage.imageBase64,
                            mimeType: generatedImage.mimeType,
                            imageSource: 'nano-banana'
                        });
                    }
                } catch (err: unknown) {
                    console.warn('Gemini image generation failed, falling back to Pollinations:', err);
                }
            }

            const fallbackImage = await fetchPollinationsImage(recipe);
            return res.status(200).json(fallbackImage);
        }

        if (action === 'magicImport') {
            if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
            const rawText = typeof body.rawText === 'string' ? body.rawText : '';
            if (!rawText) return res.status(400).json({ error: 'Missing rawText' });
            const ai = new GoogleGenAI({ apiKey: API_KEY });
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
            const result = getResponseText(response);
            return res.status(200).json({ json: result ?? '{}' });
        }

        if (action === 'magicImportBulk') {
            if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
            const rawText = typeof body.rawText === 'string' ? body.rawText : '';
            if (!rawText) return res.status(400).json({ error: 'Missing rawText' });
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text: `Multiple recipes text: ${rawText}` }] }],
                config: {
                    systemInstruction: 'Analyze this text containing one or more recipes and extract an ARRAY of structured JSON data objects. For each recipe, provide: title, category (Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip/Sauce|Snack), ingredients (list), instructions (list), prepTime, cookTime, calories (number - estimated total).',
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'ARRAY',
                        items: {
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
                }
            });
            const result = getResponseText(response);
            return res.status(200).json({ json: result ?? '[]' });
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
