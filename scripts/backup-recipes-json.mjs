#!/usr/bin/env node
/**
 * Copies bundled recipe seed data to backups/ with a timestamp.
 * Run: node scripts/backup-recipes-json.mjs
 * For Firestore exports, use Firebase Console or gcloud with a service account.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src', 'data', 'recipes.json');
const outDir = join(root, 'backups');

if (!existsSync(src)) {
    console.error('Missing', src);
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = join(outDir, `recipes-${stamp}.json`);
const data = readFileSync(src, 'utf8');
writeFileSync(dest, data, 'utf8');
console.log('Wrote', dest);
