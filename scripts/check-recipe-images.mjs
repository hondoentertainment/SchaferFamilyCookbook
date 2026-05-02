import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/recipes.json'), 'utf8'));
const imgs = new Set(recipes.map((r) => r.image).filter(Boolean));
const dir = path.join(root, 'public', 'recipe-images');
const files = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
const missing = [];
for (const img of imgs) {
  const base = img.replace(/^\/recipe-images\//, '');
  if (!files.has(base)) missing.push({ img, base });
}
const unused = [];
for (const f of files) {
  const ref = `/recipe-images/${f}`;
  if (!imgs.has(ref)) unused.push(f);
}
console.log(JSON.stringify({ recipeCount: recipes.length, uniqueImages: imgs.size, diskFiles: files.size, missing, unused }, null, 2));
