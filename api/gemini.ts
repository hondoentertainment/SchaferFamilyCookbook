import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getClientIp, slidingWindowAllow, GEMINI_RATE_LIMIT } from './lib/rateLimit';
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

    if (process.env.GEMINI_RATE_LIMIT_DISABLED !== '1') {
        const ip = getClientIp(req);
        if (!slidingWindowAllow(`gemini:${ip}`, GEMINI_RATE_LIMIT.max, GEMINI_RATE_LIMIT.windowMs)) {
            return res.status(429).json({
                error: 'Too many requests. Please wait a minute and try again.',
            });
        }
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
            if (text.length > 10000) {
                return res.status(400).json({ error: 'Text exceeds maximum length of 10000 characters' });
            }
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text }] }]
            });
            const result = typeof response.text === 'string' ? response.text : '';
            return res.status(200).json({ text: result });
        }

        if (action === 'generateImage') {
            const recipe = (body.recipe && typeof body.recipe === 'object')
                ? (body.recipe as RecipeInput)
                : undefined;
            if (!recipe?.title) return res.status(400).json({ error: 'Missing recipe' });
            if (typeof recipe.title !== 'string') {
                return res.status(400).json({ error: 'recipe.title must be a string' });
            }
            if (recipe.category !== undefined && typeof recipe.category !== 'string') {
                return res.status(400).json({ error: 'recipe.category must be a string' });
            }
            if (recipe.ingredients !== undefined && !Array.isArray(recipe.ingredients)) {
                return res.status(400).json({ error: 'recipe.ingredients must be an array' });
            }
            if (recipe.instructions !== undefined && !Array.isArray(recipe.instructions)) {
                return res.status(400).json({ error: 'recipe.instructions must be an array' });
            }

            const promptText = buildLLMPromptText(recipe);
            const contentResp = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text: promptText }] }]
            });
            const raw = typeof contentResp.text === 'string' ? contentResp.text : '';
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
            if (rawText.length > 50000) {
                return res.status(400).json({ error: 'rawText exceeds maximum length of 50000 characters' });
            }
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
            const result = typeof response.text === 'string' ? response.text : '{}';
            return res.status(200).json({ json: result });
        }

        if (action === 'parseRecipeFromImage') {
            const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
            const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
            if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
            // Server-side guard: base64 length ~= 4/3 of byte length. Reject anything > ~14MB encoded (~10MB raw).
            if (imageBase64.length > 14 * 1024 * 1024) {
                return res.status(413).json({ error: 'Image too large. Please use a photo under 10 MB.' });
            }
            if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType)) {
                return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or HEIC.' });
            }

            const visionPrompt = [
                'You are a meticulous recipe scribe. The image is a photo of a handwritten recipe card,',
                'a printed cookbook page, or a typed recipe. Read every legible word and extract the',
                'recipe into structured JSON matching the provided schema.',
                '',
                'Rules:',
                '- title: the recipe name as written. If unclear, your best guess.',
                '- ingredients: one entry per ingredient line, preserving quantities and units (e.g. "1 cup flour").',
                '- instructions: one entry per step, in order. Split run-on prose into discrete steps.',
                '- prepTime / cookTime: short strings like "15 min" or "1 hr" when present, else omit.',
                '- calories: estimated total per recipe as a number when present, else omit.',
                '- notes: any heirloom context, attribution, or non-instruction commentary (e.g. "From Grandma Schafer, 1972").',
                '- contributor: if the card is signed or attributed (e.g. "Mom\'s recipe", "by Aunt Mary"), put the name here. Else omit.',
                '- category: best fit from Breakfast | Main | Dessert | Side | Appetizer | Bread | Dip/Sauce | Snack.',
                '',
                'Return ONLY JSON. Do not wrap in Markdown fences. Do not add commentary.'
            ].join('\n');

            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: visionPrompt },
                        { inlineData: { mimeType, data: imageBase64 } }
                    ]
                }],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            title: { type: 'STRING' },
                            category: { type: 'STRING' },
                            contributor: { type: 'STRING' },
                            ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
                            instructions: { type: 'ARRAY', items: { type: 'STRING' } },
                            prepTime: { type: 'STRING' },
                            cookTime: { type: 'STRING' },
                            calories: { type: 'NUMBER' },
                            notes: { type: 'STRING' }
                        }
                    }
                }
            });
            const result = typeof response.text === 'string' ? response.text : '{}';
            return res.status(200).json({ json: result });
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

