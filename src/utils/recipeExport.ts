import { Recipe } from '../types';

/** Current export schema version. Bump when making breaking changes. */
export const EXPORT_SCHEMA_VERSION = 1;

export interface RecipeExportEnvelope {
    exportedAt: string;
    version: number;
    recipes: Recipe[];
}

/**
 * Serializes recipes to a pretty-printed JSON string wrapped in an
 * envelope containing export metadata (timestamp + schema version).
 */
export function recipesToJson(recipes: Recipe[]): string {
    const envelope: RecipeExportEnvelope = {
        exportedAt: new Date().toISOString(),
        version: EXPORT_SCHEMA_VERSION,
        recipes,
    };
    return JSON.stringify(envelope, null, 2);
}

/** Columns included in the CSV export, in order. */
export const CSV_COLUMNS = [
    'id',
    'title',
    'category',
    'contributor',
    'prepTime',
    'cookTime',
    'calories',
    'ingredients',
    'instructions',
    'notes',
    'image',
    'imageSource',
] as const;

type CsvColumn = typeof CSV_COLUMNS[number];

/**
 * Escapes a single CSV field per RFC 4180:
 * - Always wraps the value in double quotes.
 * - Doubles any existing `"` inside the value (`"` -> `""`).
 * - Newlines inside the quoted field are preserved verbatim (valid in RFC 4180).
 */
function escapeCsvField(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
}

function fieldFor(recipe: Recipe, column: CsvColumn): string {
    switch (column) {
        case 'id': return escapeCsvField(recipe.id);
        case 'title': return escapeCsvField(recipe.title);
        case 'category': return escapeCsvField(recipe.category);
        case 'contributor': return escapeCsvField(recipe.contributor);
        case 'prepTime': return escapeCsvField(recipe.prepTime ?? '');
        case 'cookTime': return escapeCsvField(recipe.cookTime ?? '');
        case 'calories': return escapeCsvField(recipe.calories ?? '');
        case 'ingredients': return escapeCsvField((recipe.ingredients ?? []).join('\n'));
        case 'instructions': return escapeCsvField((recipe.instructions ?? []).join('\n'));
        case 'notes': return escapeCsvField(recipe.notes ?? '');
        case 'image': return escapeCsvField(recipe.image ?? '');
        case 'imageSource': return escapeCsvField(recipe.imageSource ?? '');
        default: return '""';
    }
}

/**
 * Serializes recipes to a spreadsheet-friendly CSV string using RFC 4180 quoting.
 * `ingredients` and `instructions` are joined with `\n`; those newlines remain
 * intact inside the quoted field. Rows are joined with `\r\n` (RFC 4180).
 */
export function recipesToCsv(recipes: Recipe[]): string {
    const header = CSV_COLUMNS.map(escapeCsvField).join(',');
    const rows = recipes.map(recipe =>
        CSV_COLUMNS.map(col => fieldFor(recipe, col)).join(',')
    );
    return [header, ...rows].join('\r\n');
}

/**
 * Triggers a browser download of `data` as a file named `filename` with the
 * given `mimeType`. No-op (returns false) in environments without Blob /
 * URL.createObjectURL / document support (e.g. some SSR / test shims).
 */
export function downloadFile(filename: string, mimeType: string, data: string): boolean {
    if (typeof document === 'undefined') return false;
    if (typeof Blob === 'undefined') return false;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    } finally {
        if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
        }
    }
    return true;
}
