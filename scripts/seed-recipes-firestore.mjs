#!/usr/bin/env node
/**
 * Upsert every recipe from src/data/recipes.json into Firestore (recipes collection).
 * Skips documents that already exist unless --force is passed.
 *
 * Prerequisites:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
 *
 * Usage:
 *   npm run seed:recipes
 *   npm run seed:recipes -- --force
 *   npm run seed:recipes -- --dry-run
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipesPath = join(root, 'src', 'data', 'recipes.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT to a Firebase service account JSON string.');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(raw);
} catch {
    console.error('FIREBASE_SERVICE_ACCOUNT must be valid JSON');
    process.exit(1);
}

if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));

let created = 0;
let skipped = 0;
let updated = 0;

for (const recipe of recipes) {
    if (!recipe?.id) {
        console.warn('Skipping entry without id:', recipe?.title ?? recipe);
        continue;
    }
    const ref = db.collection('recipes').doc(recipe.id);
    const snap = await ref.get();
    const payload = {
        ...recipe,
        created_at: recipe.created_at || new Date().toISOString(),
    };

    if (snap.exists && !force) {
        skipped += 1;
        continue;
    }

    if (dryRun) {
        console.log(snap.exists ? `[dry-run] would update ${recipe.id} — ${recipe.title}` : `[dry-run] would create ${recipe.id} — ${recipe.title}`);
        if (snap.exists) updated += 1;
        else created += 1;
        continue;
    }

    await ref.set(payload, { merge: false });
    if (snap.exists) updated += 1;
    else created += 1;
}

console.log(`Done. created=${created} updated=${updated} skipped=${skipped} total=${recipes.length}${dryRun ? ' (dry-run)' : ''}`);
