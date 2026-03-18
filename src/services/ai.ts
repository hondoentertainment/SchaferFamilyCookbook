import { GoogleGenAI } from '@google/genai';
import { Recipe } from '../types';
import { CATEGORY_IMAGES } from '../constants';

export const getGeminiApiKey = () => {
    return ((import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        (process.env?.GEMINI_API_KEY) ||
        (process.env?.VITE_GEMINI_API_KEY) ||
        '';
};

export const needsImage = (recipe: Recipe) => {
    if (!recipe.image) return true;
    if (Object.values(CATEGORY_IMAGES).includes(recipe.image)) return true;
    if (recipe.image.includes('fallback-gradient')) return true;
    return false;
};

export const autoSourceImage = async (recipe: Recipe): Promise<string | null> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Describe the dish "${recipe.title}" (${recipe.category}) in 5-10 words for an AI image generator. Focus on the food itself in a rustic, appetizing style. Example: "fluffy blackberries pancakes with melting butter rustic farmhouse style". Return ONLY the description.`
                }]
            }],
        });
        const description = response.text.trim().replace(/['"\\n]/g, '');
        if (description.length > 5) {
            const encodedPrompt = encodeURIComponent(`${description} food photography, highly detailed, 4k, appetizing, warm lighting`);
            const seed = Math.floor(Math.random() * 1000);
            return `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;
        }
    } catch (e) {
        console.error('Auto-source image failed:', e);
    }
    return null;
};
