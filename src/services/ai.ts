export const getGeminiApiKey = () => {
    return ((import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        (process.env?.GEMINI_API_KEY) ||
        (process.env?.VITE_GEMINI_API_KEY) ||
        '';
};

export const safelyGetText = (response: any): string => {
    if (!response) return '';
    try {
        if (typeof response.text === 'function') {
            return response.text();
        }
        if (typeof response.text === 'string') {
            return response.text;
        }
        // Fallback for older SDK versions or different response structures
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts.length > 0) {
            return response.candidates[0].content.parts[0].text || '';
        }
    } catch (e) {
        console.error('Error extracting text from AI response:', e);
    }
    return '';
};
