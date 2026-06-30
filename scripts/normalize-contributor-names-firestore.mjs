#!/usr/bin/env node
/**
 * Normalize contributor display names in Firestore (recipes, gallery, trivia, contributors).
 * Uses the same alias map as src/constants/taxonomy.ts.
 *
 * Usage:
 *   FIREBASE_WEB_CONFIG='{"apiKey":"...","projectId":"..."}' node scripts/normalize-contributor-names-firestore.mjs
 *   ... --dry-run   # preview only
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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

function loadFirebaseConfig() {
    const raw = process.env.FIREBASE_WEB_CONFIG;
    if (!raw?.trim()) {
        console.error('Set FIREBASE_WEB_CONFIG to your Firebase web app config JSON.');
        process.exit(1);
    }
    const c = JSON.parse(raw);
    if (!c.apiKey || !c.projectId) {
        console.error('FIREBASE_WEB_CONFIG must include apiKey and projectId.');
        process.exit(1);
    }
    return c;
}

async function normalizeCollection(db, collectionName, field) {
    const snapshot = await getDocs(collection(db, collectionName));
    let updated = 0;
    for (const itemDoc of snapshot.docs) {
        const item = itemDoc.data();
        const current = item[field];
        if (typeof current !== 'string' || !current.trim()) continue;
        const next = normalizeContributor(current);
        if (next === current) continue;
        console.log(`  ${collectionName}/${itemDoc.id}: "${current}" → "${next}"`);
        if (!dryRun) {
            await updateDoc(doc(db, collectionName, itemDoc.id), { [field]: next });
        }
        updated++;
    }
    return updated;
}

async function dedupeContributors(db) {
    const snapshot = await getDocs(collection(db, 'contributors'));
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
            if (!dryRun) await deleteDoc(doc(db, 'contributors', itemDoc.id));
            removed++;
            continue;
        }
        byCanonical.set(key, itemDoc.id);
        if (canonical !== current) {
            console.log(`  contributors/${itemDoc.id}: "${current}" → "${canonical}"`);
            if (!dryRun) await updateDoc(doc(db, 'contributors', itemDoc.id), { name: canonical });
        }
    }
    return removed;
}

async function main() {
    console.log(dryRun ? '🔍 Dry run — no writes' : '🔄 Normalizing contributor names in Firestore…');
    const app = initializeApp(loadFirebaseConfig());
    const db = getFirestore(app);

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
