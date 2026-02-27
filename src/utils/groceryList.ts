const STORAGE_KEY = 'schafer_grocery';

export interface GroceryItem {
    id: string;
    text: string;
    checked: boolean;
    recipeId?: string;
    recipeTitle?: string;
    category?: string;
    addedAt: number;
}

/** Infer category from ingredient text. Backward-compatible: items without category get inferred at display time. */
export function inferCategory(text: string): string {
    const t = text.toLowerCase();
    const categories: Array<{ keys: string[]; name: string }> = [
        { keys: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'sour cream', 'evaporated milk'], name: 'Dairy' },
        { keys: ['egg'], name: 'Dairy' },
        { keys: ['apple', 'banana', 'berry', 'orange', 'lemon', 'lime', 'onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery', 'broccoli', 'spinach', 'lettuce', 'bell pepper', 'avocado', 'mushroom', 'herb', 'parsley', 'cilantro', 'ginger'], name: 'Produce' },
        { keys: ['beef', 'chicken', 'pork', 'bacon', 'ham', 'sausage', 'fish', 'salmon', 'turkey', 'shrimp'], name: 'Meat & Seafood' },
        { keys: ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'honey', 'syrup', 'vanilla', 'baking', 'chocolate', 'cinnamon', 'nutmeg', 'spice', 'mustard', 'peanut butter', 'jam', 'marshmallow'], name: 'Pantry' },
    ];
    for (const { keys, name } of categories) {
        if (keys.some(k => t.includes(k))) return name;
    }
    return 'Other';
}

function loadItems(): GroceryItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as GroceryItem[];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveItems(items: GroceryItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

let idCounter = 0;
function generateId(): string {
    return `grocery_${Date.now()}_${++idCounter}`;
}

/** Get all grocery items (unchecked first, grouped by category/recipe; checked at bottom). */
export function getGroceryItems(): GroceryItem[] {
    const items = loadItems();
    return items.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        const catA = a.category ?? inferCategory(a.text);
        const catB = b.category ?? inferCategory(b.text);
        if (catA !== catB) return catA.localeCompare(catB);
        const srcA = a.recipeTitle ?? a.recipeId ?? '';
        const srcB = b.recipeTitle ?? b.recipeId ?? '';
        if (srcA !== srcB) return srcA.localeCompare(srcB);
        return b.addedAt - a.addedAt;
    });
}

/** Add ingredients from a recipe to the grocery list. Returns new item count added. */
export function addFromRecipe(ingredients: string[], recipeId?: string, recipeTitle?: string): number {
    const existing = loadItems();
    const existingTexts = new Set(existing.map((i) => i.text.toLowerCase().trim()));
    let added = 0;
    for (const text of ingredients) {
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (existingTexts.has(trimmed.toLowerCase())) continue;
        existing.push({
            id: generateId(),
            text: trimmed,
            checked: false,
            recipeId,
            recipeTitle,
            category: inferCategory(trimmed),
            addedAt: Date.now(),
        });
        existingTexts.add(trimmed.toLowerCase());
        added++;
    }
    saveItems(existing);
    return added;
}

/** Toggle checked state of an item. */
export function toggleGroceryItem(id: string): void {
    const items = loadItems();
    const item = items.find((i) => i.id === id);
    if (item) {
        item.checked = !item.checked;
        saveItems(items);
    }
}

/** Remove an item from the list. */
export function removeGroceryItem(id: string): void {
    const items = loadItems().filter((i) => i.id !== id);
    saveItems(items);
}

/** Clear all checked items. */
export function clearCheckedItems(): void {
    const items = loadItems().filter((i) => !i.checked);
    saveItems(items);
}
