#!/usr/bin/env node
/**
 * Audit (and optionally generate / apply) CRON_SECRET for Recipe of the Week.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to
 * `/api/recipe-of-the-week` (see vercel.json `crons`). Without this var the
 * weekly job is 401 and the push stays dormant — even if FCM is configured.
 *
 * Usage:
 *   npm run configure:cron
 *   npm run configure:cron -- --generate   # print a random secret (do not commit)
 *   npm run configure:cron -- --apply      # generate if needed + set on Vercel production
 *
 * Never invent a value in git. Paste a generated secret into .env.local or
 * let --apply set it on Vercel only.
 */
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';
import { listVercelEnvNames, setVercelEnv } from './lib/vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const generate = process.argv.includes('--generate');
const apply = process.argv.includes('--apply');
const VAR = 'CRON_SECRET';

function newSecret() {
    return randomBytes(24).toString('base64url');
}

if (generate) {
    const secret = newSecret();
    console.log('Recipe of the Week cron secret\n');
    console.log('── Generated CRON_SECRET (set on Vercel; do not commit) ──');
    console.log(secret);
    console.log('\nVercel CLI (production):');
    console.log('  npx vercel env add CRON_SECRET production');
    console.log('\nOr: npm run configure:cron -- --apply');
    process.exit(0);
}

console.log('Recipe of the Week cron secret\n');

const local = process.env[VAR]?.trim() ?? '';
const names = listVercelEnvNames();
const onVercel = names?.has(VAR) ?? false;

if (local) {
    console.log('✅ CRON_SECRET present locally (value not printed)');
} else {
    console.log('❌ CRON_SECRET missing locally');
}

if (onVercel) {
    console.log('✅ CRON_SECRET name exists on Vercel production');
} else if (names) {
    console.log('❌ CRON_SECRET not set on Vercel production');
} else {
    console.log('ℹ️  Could not list Vercel env (vercel login / link required to audit remote)');
}

console.log('\n── Kyle (custodian) ──');
console.log('1. Generate a long random string (do not commit it):');
console.log('     npm run configure:cron -- --generate');
console.log('2. Apply to Vercel production (uses .env.local if set, otherwise generates):');
console.log('     npm run configure:cron -- --apply');
console.log('3. Redeploy: npx vercel deploy --prod --yes');
console.log('4. Dry-run the pick: curl -sS "$PROD/api/recipe-of-the-week?dryRun=1" \\');
console.log('     -H "Authorization: Bearer $CRON_SECRET"');
console.log('   Weekly cron: Sunday 15:00 UTC → /api/recipe-of-the-week (vercel.json)');
console.log('   Push delivery still needs VITE_FCM_VAPID_KEY (npm run configure:fcm)');

if (apply) {
    const secret = local || newSecret();
    if (!local) {
        console.log('\nℹ️  No local CRON_SECRET — generated a new value for Vercel only');
    }
    console.log('\nApplying CRON_SECRET to Vercel production…');
    const add = setVercelEnv(VAR, secret);
    if ((add.status ?? 1) !== 0) {
        console.error('Failed:', add.stderr || add.stdout);
        process.exit(1);
    }
    console.log('✅ CRON_SECRET set on Vercel production (value not printed).');
    console.log('Redeploy: npx vercel deploy --prod --yes');
    process.exit(0);
}

process.exit(local || onVercel ? 0 : 1);
