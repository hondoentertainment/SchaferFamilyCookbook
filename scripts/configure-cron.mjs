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
 *   npm run configure:cron -- --apply      # set on Vercel only if missing remotely
 *   npm run configure:cron -- --apply --rotate   # replace an existing Vercel value
 *
 * Never invent a value in git. Vercel-only is the intended state after --apply
 * (the generated value is not printed). Keep a local copy only if you need
 * manual dry-runs (`--generate` then paste into `.env.local`).
 */
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';
import { listVercelEnvNames, setVercelEnv } from './lib/vercel-env.mjs';

const VAR = 'CRON_SECRET';

/** Decide what --apply should do. Vercel-only is valid; do not rotate it. */
export function resolveCronApply({ hasLocal, onVercel, rotate }) {
    if (hasLocal) return 'apply-local';
    if (onVercel && !rotate) return 'keep-remote';
    return 'generate-remote';
}

export function newCronSecret() {
    return randomBytes(24).toString('base64url');
}

function isMain() {
    const argvEntry = process.argv[1];
    if (!argvEntry) return false;
    try {
        const here = fileURLToPath(import.meta.url);
        const there = resolve(argvEntry);
        return process.platform === 'win32' ? here.toLowerCase() === there.toLowerCase() : here === there;
    } catch {
        return false;
    }
}

function runCli() {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    loadLocalOpsEnv(root);

    const generate = process.argv.includes('--generate');
    const apply = process.argv.includes('--apply');
    const rotate = process.argv.includes('--rotate');

    if (generate) {
        const secret = newCronSecret();
        console.log('Recipe of the Week cron secret\n');
        console.log('── Generated CRON_SECRET (set on Vercel; do not commit) ──');
        console.log(secret);
        console.log('\nVercel CLI (production):');
        console.log('  npx vercel env add CRON_SECRET production');
        console.log('\nOr: npm run configure:cron -- --apply');
        console.log('Manual dry-run later: keep this value locally (not in git).');
        process.exit(0);
    }

    console.log('Recipe of the Week cron secret\n');

    const local = process.env[VAR]?.trim() ?? '';
    const names = listVercelEnvNames();
    const onVercel = names?.has(VAR) ?? false;

    if (local) {
        console.log('✅ CRON_SECRET present locally (value not printed)');
    } else if (onVercel) {
        console.log('ℹ️  Local CRON_SECRET optional — name already exists on Vercel');
        console.log('   (encrypted pull may omit the value; Vercel Cron still works)');
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
    console.log('1. First-time apply (generates a secret on Vercel only — do not commit it):');
    console.log('     npm run configure:cron -- --apply');
    console.log('2. Redeploy: npx vercel deploy --prod --yes');
    console.log('3. Optional dry-run: npm run configure:cron -- --generate, keep the value');
    console.log('     locally, then: curl -sS "$PROD/api/recipe-of-the-week?dryRun=1" \\');
    console.log('     -H "Authorization: Bearer $CRON_SECRET"');
    console.log('   Weekly cron: Sunday 15:00 UTC → /api/recipe-of-the-week (vercel.json)');
    console.log('   Rotate only if needed: npm run configure:cron -- --apply --rotate');
    console.log('   Push delivery still needs VITE_FCM_VAPID_KEY (npm run configure:fcm)');

    if (apply) {
        const action = resolveCronApply({ hasLocal: Boolean(local), onVercel, rotate });
        if (action === 'keep-remote') {
            console.log('\nℹ️  CRON_SECRET already on Vercel — leaving it in place.');
            console.log('   Re-apply will not rotate. To replace: npm run configure:cron -- --apply --rotate');
            process.exit(0);
        }
        const secret = action === 'apply-local' ? local : newCronSecret();
        if (action === 'generate-remote') {
            console.log('\nℹ️  No local CRON_SECRET — generated a new value for Vercel only');
        } else if (rotate) {
            console.log('\nℹ️  --rotate: replacing the existing Vercel CRON_SECRET');
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
}

if (isMain()) {
    runCli();
}
