#!/usr/bin/env node
/**
 * Audit (and optionally apply) Firebase App Check site key on Vercel.
 *
 * Usage:
 *   npm run configure:app-check
 *   npm run configure:app-check -- --apply
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';
import { applyVercelEnvVars, listVercelEnvNames } from './lib/vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const apply = process.argv.includes('--apply');
const VAR = 'VITE_FIREBASE_APP_CHECK_SITE_KEY';

console.log('Firebase App Check configuration\n');

const siteKey = process.env[VAR]?.trim() ?? '';
if (siteKey) {
    console.log('✅ VITE_FIREBASE_APP_CHECK_SITE_KEY present locally');
} else {
    console.log('❌ VITE_FIREBASE_APP_CHECK_SITE_KEY missing');
    console.log('\n── Kyle: App Check ──');
    console.log('   1. Firebase Console → App Check → Register the web app → reCAPTCHA v3');
    console.log('   2. Paste the site key into .env.local as VITE_FIREBASE_APP_CHECK_SITE_KEY');
    console.log('   3. npm run configure:app-check -- --apply');
    console.log('   4. Redeploy production (App Check initializes only in production builds)');
    console.log('   See docs/FIREBASE_SECURITY.md — do not invent a site key in git.');
}

const names = listVercelEnvNames();
if (names?.has(VAR)) {
    console.log('\n✅ App Check var name exists on Vercel production');
} else if (names) {
    console.log('\n❌ VITE_FIREBASE_APP_CHECK_SITE_KEY not on Vercel production');
}

if (apply) {
    if (!siteKey) {
        console.log('\nℹ️  Skipping --apply (VITE_FIREBASE_APP_CHECK_SITE_KEY not in .env.local)');
    } else {
        console.log('\nApplying App Check site key to Vercel production…');
        const result = applyVercelEnvVars([VAR]);
        if (!result.ok) {
            console.error('Failed to set App Check key');
            process.exit(1);
        }
        console.log('✅ VITE_FIREBASE_APP_CHECK_SITE_KEY set. Redeploy production.');
    }
}

process.exit(siteKey ? 0 : 1);
