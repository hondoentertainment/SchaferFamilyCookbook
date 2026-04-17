import { describe, it, expect } from 'vitest';
import { recipesToCsv, recipesToJson } from './recipeExport';
import type { Recipe } from '../types';

const sample: Recipe = {
  id: 'r1',
  title: 'Grandma\'s "Best" Pie',
  contributor: 'Alice',
  category: 'Dessert',
  ingredients: ['2 cups flour', '1 tsp salt'],
  instructions: ['Mix.', 'Bake at 350°F.'],
  notes: 'A family\nfavorite',
  image: 'https://example.com/pie.jpg',
};

describe('recipeExport', () => {
  it('produces pretty JSON', () => {
    const json = recipesToJson([sample]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe(sample.title);
    expect(json).toContain('\n');
  });

  it('escapes quotes, commas, and newlines in CSV', () => {
    const csv = recipesToCsv([sample]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('id,title');
    expect(csv).toContain('"Grandma\'s ""Best"" Pie"');
    expect(csv).toContain('2 cups flour | 1 tsp salt');
    expect(csv).toContain('"A family\nfavorite"');
  });

  it('handles empty recipe arrays', () => {
    const csv = recipesToCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(recipesToJson([])).toBe('[]');
  });
});
