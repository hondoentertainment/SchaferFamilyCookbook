#!/usr/bin/env node
/**
 * Audit (and optionally apply) Firebase Cloud Messaging client vars on Vercel.
 *
 * Usage:
 *   npm run configure:fcm
 *   npm run configure:fcm -- --apply
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';
import { applyVercelEnvVars, listVercelEnvNames } from './lib/vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const apply = process.argv.includes('--apply');
const FCM_VARS = [
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FCM_VAPID_KEY',
];

console.log('FCM (push notifications) configuration\n');

const missingLocal = FCM_VARS.filter((k) => !process.env[k]?.trim());
if (missingLocal.length === 0) {
    console.log('✅ All FCM client vars present locally');
} else {
    console.log('❌ Missing locally (Firebase Console → Project settings → Cloud Messaging):');
    for (const k of missingLocal) console.log(`   - ${k}`);
    console.log('   See docs/FIREBASE_PUSH_NOTIFICATIONS.md');
}

const names = listVercelEnvNames();
if (names) {
    const missingVercel = FCM_VARS.filter((k) => !names.has(k));
    if (missingVercel.length === 0) {
        console.log('\n✅ All FCM var names exist on Vercel production');
    } else {
        console.log('\n❌ Missing on Vercel production:');
        for (const k of missingVercel) console.log(`   - ${k}`);
    }
}

if (apply) {
    console.log('\nApplying FCM vars to Vercel production (from .env.local / pull)…');
    const result = applyVercelEnvVars(FCM_VARS);
    if (!result.ok) {
        console.error(`Failed to set ${result.failed}`);
        process.exit(1);
    }
    if (result.applied.length > 0) {
        console.log(`✅ Applied: ${result.applied.join(', ')}`);
    }
    if (result.skipped.length > 0) {
        console.log(`ℹ️  Skipped (no local value): ${result.skipped.join(', ')}`);
    }
    console.log('Redeploy: npx vercel deploy --prod --yes');
}

process.exit(missingLocal.length === 0 ? 0 : 1);
