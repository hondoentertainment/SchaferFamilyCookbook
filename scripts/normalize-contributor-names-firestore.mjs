#!/usr/bin/env node
/**
 * Normalize contributor display names in Firestore (recipes, gallery, trivia, contributors).
 * Uses firebase-admin (FIREBASE_SERVICE_ACCOUNT) — same as seed-recipes.
 *
 * Usage:
 *   npm run normalize:contributors:dry-run
 *   npm run normalize:contributors
 *
 * Loads `.env.vercel.local` when present. Encrypted Vercel vars may be empty locally;
 * export FIREBASE_SERVICE_ACCOUNT from Firebase Console if needed.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { loadLocalOpsEnv } from './load-local-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const dryRun = process.argv.includes('--dry-run');

const ALIASES = {
    'dawn schafer tessmer': 'Dawn',
    'dawn (schafer) tessmer': 'Dawn',
    dawn: 'Dawn',
    'harriet oehler schafer': 'Harriet',
    'harriet (oehler) schafer': 'Harriet',
    harriet: 'Harriet',
    'jana schafer': 'Jana',
    'robin henderson': 'Robin',
    wren: 'Wren',
    'wren feyereisen': 'Wren',
};

function normalizeKey(value = '') {
    return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeContributor(value) {
    const name = String(value || '').trim();
    if (!name) return name;
    return ALIASES[normalizeKey(name)] ?? name;
}

function initAdmin() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (!raw) {
        console.error('Set FIREBASE_SERVICE_ACCOUNT (Firebase Console → service account JSON).');
        console.error('Tip: npm run vercel:env:pull then paste into .env.local if Vercel pull omits encrypted values.');
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
    return admin.firestore();
}

async function normalizeCollection(db, collectionName, field) {
    const snapshot = await db.collection(collectionName).get();
    let updated = 0;
    for (const itemDoc of snapshot.docs) {
        const item = itemDoc.data();
        const current = item[field];
        if (typeof current !== 'string' || !current.trim()) continue;
        const next = normalizeContributor(current);
        if (next === current) continue;
        console.log(`  ${collectionName}/${itemDoc.id}: "${current}" → "${next}"`);
        if (!dryRun) {
            await itemDoc.ref.update({ [field]: next });
        }
        updated++;
    }
    return updated;
}

async function dedupeContributors(db) {
    const snapshot = await db.collection('contributors').get();
    const byCanonical = new Map();
    let removed = 0;
    for (const itemDoc of snapshot.docs) {
        const item = itemDoc.data();
        const current = typeof item.name === 'string' ? item.name : '';
        const canonical = normalizeContributor(current);
        const key = normalizeKey(canonical);
        if (!key) continue;
        if (byCanonical.has(key)) {
            console.log(`  contributors/${itemDoc.id}: remove duplicate "${current}"`);
            if (!dryRun) await itemDoc.ref.delete();
            removed++;
            continue;
        }
        byCanonical.set(key, itemDoc.id);
        if (canonical !== current) {
            console.log(`  contributors/${itemDoc.id}: "${current}" → "${canonical}"`);
            if (!dryRun) await itemDoc.ref.update({ name: canonical });
        }
    }
    return removed;
}

async function main() {
    console.log(dryRun ? '🔍 Dry run — no writes' : '🔄 Normalizing contributor names in Firestore…');
    const db = initAdmin();

    const targets = [
        { name: 'recipes', field: 'contributor' },
        { name: 'gallery', field: 'contributor' },
        { name: 'trivia', field: 'contributor' },
    ];

    let total = 0;
    for (const target of targets) {
        console.log(`\n📦 ${target.name}`);
        total += await normalizeCollection(db, target.name, target.field);
    }

    console.log('\n👤 contributors');
    const removed = await dedupeContributors(db);

    console.log(`\n✅ Done. Updated ${total} document(s); removed ${removed} duplicate contributor profile(s).`);
    if (dryRun) console.log('Re-run without --dry-run to apply changes.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
