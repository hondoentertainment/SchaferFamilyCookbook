#!/usr/bin/env node
/**
 * Pull Firebase web app SDK config via Firebase CLI and apply client vars to Vercel.
 *
 * Usage:
 *   npm run configure:firebase-web
 *   npm run configure:firebase-web -- --apply
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyVercelEnvVars } from './lib/vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'schafer-cookbook';

console.log(`Firebase web SDK config (${PROJECT})\n`);

const list = spawnSync('firebase', ['apps:list', '--project', PROJECT, '--json'], {
    encoding: 'utf8',
    shell: true,
    cwd: root,
});
if ((list.status ?? 1) !== 0) {
    console.error('firebase apps:list failed — run `firebase login` first');
    process.exit(1);
}

let apps;
try {
    const parsed = JSON.parse(list.stdout || '{}');
    apps = parsed.result || parsed;
} catch {
    console.error('Could not parse firebase apps:list JSON');
    process.exit(1);
}

const webApps = (Array.isArray(apps) ? apps : apps?.apps || []).filter(
    (a) => String(a.platform || a.appType || '').toUpperCase() === 'WEB',
);
if (webApps.length === 0) {
    console.error('No WEB apps found. Create one: firebase apps:create WEB "Schafer Family Cookbook"');
    process.exit(1);
}

const appId = webApps[0].appId || webApps[0].name;
const cfgResult = spawnSync(
    'firebase',
    ['apps:sdkconfig', 'WEB', appId, '--project', PROJECT, '--json'],
    { encoding: 'utf8', shell: true, cwd: root },
);
if ((cfgResult.status ?? 1) !== 0) {
    console.error(cfgResult.stderr || cfgResult.stdout);
    process.exit(1);
}

let sdk;
try {
    const parsed = JSON.parse(cfgResult.stdout || '{}');
    sdk = parsed.result?.sdkConfig || parsed.result || parsed.sdkConfig || parsed;
} catch {
    console.error('Could not parse sdkconfig JSON');
    process.exit(1);
}

const mapping = {
    VITE_FIREBASE_API_KEY: sdk.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: sdk.authDomain,
    VITE_FIREBASE_PROJECT_ID: sdk.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: sdk.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: sdk.messagingSenderId,
    VITE_FIREBASE_APP_ID: sdk.appId,
};

for (const [k, v] of Object.entries(mapping)) {
    if (v) {
        console.log(`✅ ${k}`);
        process.env[k] = String(v);
    } else {
        console.log(`❌ ${k} missing from sdkconfig`);
    }
}

console.log('\nℹ️  VITE_FCM_VAPID_KEY still requires Firebase Console → Cloud Messaging → Web Push certificates');

if (apply) {
    console.log('\nApplying Firebase web client vars to Vercel production…');
    const result = applyVercelEnvVars(Object.keys(mapping));
    if (!result.ok) {
        console.error(`Failed to set ${result.failed}`);
        process.exit(1);
    }
    console.log(`✅ Applied: ${result.applied.join(', ')}`);
    if (result.skipped.length) console.log(`ℹ️  Skipped: ${result.skipped.join(', ')}`);
    console.log('Redeploy: npx vercel deploy --prod --yes');
}

process.exit(0);
