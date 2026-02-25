/**
 * Parse a leading quantity from an ingredient string.
 * Handles: "2 cups", "1/2 tsp", "1 1/2 cups", "3-4", "2 to 3", decimals.
 */
function parseLeadingQuantity(str: string): { value: number; rest: string } | null {
    const s = str.trim();
    // Match: optional whole number, optional space, optional fraction (n/d)
    // e.g. "2", "1/2", "1 1/2", "2.5"
    const mixed = /^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/.exec(s); // "1 1/2 cups"
    if (mixed) {
        const whole = parseInt(mixed[1], 10);
        const num = parseInt(mixed[2], 10);
        const den = parseInt(mixed[3], 10);
        if (den !== 0) {
            return { value: whole + num / den, rest: mixed[4].trim() };
        }
    }
    const fraction = /^(\d+)\/(\d+)\s*(.*)$/.exec(s); // "1/2 cup"
    if (fraction) {
        const num = parseInt(fraction[1], 10);
        const den = parseInt(fraction[2], 10);
        if (den !== 0) {
            return { value: num / den, rest: fraction[3].trim() };
        }
    }
    const decimal = /^(\d+\.?\d*)\s*(.*)$/.exec(s); // "2" or "2.5"
    if (decimal) {
        return { value: parseFloat(decimal[1]), rest: decimal[2].trim() };
    }
    return null;
}

/**
 * Format a scaled number for display (avoid long decimals).
 */
function formatQuantity(n: number): string {
    if (Number.isInteger(n)) return String(n);
    // Common fractions
    const tol = 0.02;
    if (Math.abs(n - 0.25) < tol) return '1/4';
    if (Math.abs(n - 0.33) < tol || Math.abs(n - 0.333) < tol) return '1/3';
    if (Math.abs(n - 0.5) < tol) return '1/2';
    if (Math.abs(n - 0.67) < tol || Math.abs(n - 0.667) < tol) return '2/3';
    if (Math.abs(n - 0.75) < tol) return '3/4';
    if (Math.abs(n - 1.5) < tol) return '1 1/2';
    if (Math.abs(n - 2.5) < tol) return '2 1/2';
    return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/**
 * Scale a single ingredient string by the given factor.
 * Returns the scaled string, or the original if no parseable quantity.
 */
export function scaleIngredient(ingredient: string, factor: number): string {
    if (factor === 1) return ingredient;
    const parsed = parseLeadingQuantity(ingredient);
    if (!parsed || parsed.value === 0) return ingredient;
    const scaled = parsed.value * factor;
    const formatted = formatQuantity(scaled);
    return parsed.rest ? `${formatted} ${parsed.rest}` : formatted;
}

/**
 * Scale an array of ingredients by the given factor.
 */
export function scaleIngredients(ingredients: string[], factor: number): string[] {
    if (factor === 1) return ingredients;
    return ingredients.map((ing) => scaleIngredient(ing, factor));
}
