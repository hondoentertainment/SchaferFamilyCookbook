import type { Recipe } from '../types';

const DEFAULT_TITLE = 'Schafer Family Cookbook';
const DEFAULT_DESCRIPTION =
  'A digital archive of heirloom recipes, family photos, and culinary history.';
const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=1200&h=630';

function setMeta(selector: string, attr: 'content', value: string): void {
  const el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (el) el.setAttribute(attr, value);
}

function upsertMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export function setRecipeMeta(recipe: Recipe): void {
  const title = `${recipe.title} — ${DEFAULT_TITLE}`;
  const description =
    recipe.notes?.slice(0, 200) ||
    `${recipe.category} by ${recipe.contributor}. ${recipe.ingredients.slice(0, 3).join(', ')}...`;
  const image = recipe.image || DEFAULT_IMAGE;

  document.title = title;
  setMeta('meta[name="description"]', 'content', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:type', 'article');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', image);
}

export function resetMeta(): void {
  document.title = DEFAULT_TITLE;
  setMeta('meta[name="description"]', 'content', DEFAULT_DESCRIPTION);
  upsertMeta('property', 'og:title', DEFAULT_TITLE);
  upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION);
  upsertMeta('property', 'og:image', DEFAULT_IMAGE);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:title', DEFAULT_TITLE);
  upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
  upsertMeta('name', 'twitter:image', DEFAULT_IMAGE);
}
