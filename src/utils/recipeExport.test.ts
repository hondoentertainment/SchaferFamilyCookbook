import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Recipe } from '../types';
import {
    recipesToJson,
    recipesToCsv,
    downloadFile,
    CSV_COLUMNS,
    EXPORT_SCHEMA_VERSION,
} from './recipeExport';

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'r1',
    title: 'Apple Pie',
    contributor: 'Grandma',
    category: 'Dessert',
    ingredients: ['2 cups flour', '1 cup sugar'],
    instructions: ['Mix', 'Bake'],
    notes: 'Family favorite',
    image: 'https://example.com/pie.jpg',
    imageSource: 'upload',
    prepTime: '20 min',
    cookTime: '45 min',
    calories: 350,
    ...overrides,
});

describe('recipesToJson', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('wraps recipes in an envelope with exportedAt, version, and recipes', () => {
        const recipes = [makeRecipe()];
        const json = recipesToJson(recipes);
        const parsed = JSON.parse(json);

        expect(parsed).toHaveProperty('exportedAt', '2026-04-19T12:00:00.000Z');
        expect(parsed).toHaveProperty('version', EXPORT_SCHEMA_VERSION);
        expect(parsed).toHaveProperty('recipes');
        expect(parsed.recipes).toHaveLength(1);
        expect(parsed.recipes[0].title).toBe('Apple Pie');
    });

    it('produces pretty-printed JSON (contains newlines and indentation)', () => {
        const json = recipesToJson([makeRecipe()]);
        expect(json).toContain('\n');
        expect(json).toContain('  ');
    });

    it('handles an empty recipe list', () => {
        const json = recipesToJson([]);
        const parsed = JSON.parse(json);
        expect(parsed.recipes).toEqual([]);
        expect(parsed.version).toBe(EXPORT_SCHEMA_VERSION);
        expect(typeof parsed.exportedAt).toBe('string');
    });
});

describe('recipesToCsv', () => {
    it('emits a header row with all expected columns', () => {
        const csv = recipesToCsv([]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(1);
        const expectedHeader = CSV_COLUMNS.map(c => `"${c}"`).join(',');
        expect(lines[0]).toBe(expectedHeader);
    });

    it('joins ingredients and instructions with newlines inside quoted fields', () => {
        const csv = recipesToCsv([makeRecipe({
            ingredients: ['1 cup flour', '2 eggs', '1 tsp salt'],
            instructions: ['Mix dry', 'Add wet', 'Bake'],
        })]);
        expect(csv).toContain('"1 cup flour\n2 eggs\n1 tsp salt"');
        expect(csv).toContain('"Mix dry\nAdd wet\nBake"');
    });

    it('escapes double quotes by doubling them (RFC 4180)', () => {
        const csv = recipesToCsv([makeRecipe({
            title: 'She said "hi"',
            notes: 'Quote: "yum"',
        })]);
        expect(csv).toContain('"She said ""hi"""');
        expect(csv).toContain('"Quote: ""yum"""');
    });

    it('preserves commas inside quoted fields (does not split the row)', () => {
        const csv = recipesToCsv([makeRecipe({
            title: 'Salt, Pepper, and Spice',
            notes: 'Serves 4, maybe 5',
        })]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(2);
        expect(lines[1]).toContain('"Salt, Pepper, and Spice"');
        expect(lines[1]).toContain('"Serves 4, maybe 5"');
    });

    it('preserves literal newlines inside notes and ingredients', () => {
        const csv = recipesToCsv([makeRecipe({
            notes: 'Line one\nLine two',
            ingredients: ['A', 'B'],
        })]);
        expect(csv).toContain('"Line one\nLine two"');
        expect(csv).toContain('"A\nB"');
    });

    it('handles missing optional fields as empty strings', () => {
        const recipe = makeRecipe();
        delete recipe.notes;
        delete recipe.prepTime;
        delete recipe.cookTime;
        delete recipe.calories;
        delete recipe.image;
        delete recipe.imageSource;

        const csv = recipesToCsv([recipe]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(2);
        // Each missing optional field serializes as an empty quoted string.
        expect(lines[1]).toContain('""');
    });

    it('returns header only when given an empty recipe list', () => {
        const csv = recipesToCsv([]);
        expect(csv.split('\r\n')).toHaveLength(1);
    });

    it('emits one row per recipe plus the header', () => {
        const csv = recipesToCsv([
            makeRecipe({ id: 'r1' }),
            makeRecipe({ id: 'r2', title: 'Pumpkin Pie' }),
            makeRecipe({ id: 'r3', title: 'Cherry Pie' }),
        ]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(4); // 1 header + 3 rows
        expect(lines[1]).toContain('"r1"');
        expect(lines[2]).toContain('"Pumpkin Pie"');
        expect(lines[3]).toContain('"Cherry Pie"');
    });
});

describe('downloadFile', () => {
    let clickSpy: ReturnType<typeof vi.fn>;
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
        clickSpy = vi.fn();
        createObjectURLSpy = vi.fn(() => 'blob:mock-url');
        revokeObjectURLSpy = vi.fn();

        vi.stubGlobal('URL', {
            createObjectURL: createObjectURLSpy,
            revokeObjectURL: revokeObjectURLSpy,
        });

        originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                (el as HTMLAnchorElement).click = clickSpy as unknown as () => void;
            }
            return el;
        }) as typeof document.createElement);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('creates a Blob URL and clicks an anchor', () => {
        const result = downloadFile('test.json', 'application/json', '{"a":1}');
        expect(result).toBe(true);
        expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
});
