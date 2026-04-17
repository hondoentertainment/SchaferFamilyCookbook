import type { Recipe } from '../types';

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADERS: (keyof Recipe)[] = [
  'id',
  'title',
  'contributor',
  'category',
  'servings',
  'prepTime',
  'cookTime',
  'calories',
  'ingredients',
  'instructions',
  'notes',
  'image',
  'imageSource',
  'created_at',
];

export function recipesToCsv(recipes: Recipe[]): string {
  const rows = [CSV_HEADERS.join(',')];
  for (const r of recipes) {
    const row = CSV_HEADERS.map((key) => {
      const v = r[key] as unknown;
      if (Array.isArray(v)) return escapeCsv(v.join(' | '));
      return escapeCsv(v as string | number | undefined);
    });
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

export function recipesToJson(recipes: Recipe[]): string {
  return JSON.stringify(recipes, null, 2);
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRecipesJson(recipes: Recipe[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(recipesToJson(recipes), `schafer-recipes-${stamp}.json`, 'application/json');
}

export function exportRecipesCsv(recipes: Recipe[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(recipesToCsv(recipes), `schafer-recipes-${stamp}.csv`, 'text/csv;charset=utf-8');
}
