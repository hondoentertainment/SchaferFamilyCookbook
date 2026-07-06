#!/usr/bin/env node
/**
 * Audit (and optionally bootstrap) gallery approve / admin push notify secrets.
 *
 * Usage:
 *   npm run configure:notify
 *   npm run configure:notify -- --generate   # print a random secret to set on Vercel
 *   npm run configure:notify -- --apply        # generate + set both secrets on Vercel production
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const generate = process.argv.includes('--generate');
const apply = process.argv.includes('--apply');

function run(cmd, args, input) {
    const r = spawnSync(cmd, args, {
        encoding: 'utf8',
        shell: true,
        input,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function listVercelEnv() {
    const r = spawnSync('npx', ['vercel', 'env', 'ls'], { encoding: 'utf8', shell: true });
    if (r.status !== 0) return null;
    return r.stdout ?? '';
}

function setVercelEnv(name, value) {
    run('npx', ['vercel', 'env', 'rm', name, 'production', '--yes']);
    return run('npx', ['vercel', 'env', 'add', name, 'production'], `${value}\n`);
}

console.log('Push notify configuration\n');

const hasClient = !!process.env.VITE_NOTIFY_SECRET?.trim();
const hasServer = !!process.env.NOTIFY_SECRET?.trim();

const vercelList = listVercelEnv();
const vercelNames = vercelList
    ? new Set(
          vercelList
              .split('\n')
              .map((line) => line.trim().split(/\s+/)[0])
              .filter((name) => name && /^[A-Z0-9_]+$/.test(name)),
      )
    : null;
const onVercel = vercelNames?.has('NOTIFY_SECRET') && vercelNames?.has('VITE_NOTIFY_SECRET');

if (hasClient && hasServer) {
    if (process.env.VITE_NOTIFY_SECRET.trim() === process.env.NOTIFY_SECRET.trim()) {
        console.log('✅ NOTIFY_SECRET and VITE_NOTIFY_SECRET are set locally (matching values required)');
    } else {
        console.log('❌ NOTIFY_SECRET and VITE_NOTIFY_SECRET differ locally — they must be the same value');
    }
} else if (onVercel) {
    console.log('✅ NOTIFY_SECRET and VITE_NOTIFY_SECRET configured on Vercel (local copy optional for --apply)');
} else {
    if (!hasServer) console.log('❌ NOTIFY_SECRET missing on server (Vercel → api/notify)');
    if (!hasClient) console.log('❌ VITE_NOTIFY_SECRET missing in client bundle');
}

const fcm = [
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FCM_VAPID_KEY',
].filter((k) => !process.env[k]?.trim());

if (fcm.length === 0) {
    console.log('✅ FCM client vars present (device tokens can register)');
} else {
    console.log('\nℹ️  FCM optional (needed for push delivery to devices):');
    for (const k of fcm) console.log(`   - ${k}`);
    console.log('   See docs/FIREBASE_PUSH_NOTIFICATIONS.md');
}

if (generate) {
    const secret = randomBytes(24).toString('base64url');
    console.log('\n── Generated shared secret (set BOTH vars to this value) ──');
    console.log(secret);
    console.log('\nVercel CLI (production):');
    console.log(`  npx vercel env add NOTIFY_SECRET production`);
    console.log(`  npx vercel env add VITE_NOTIFY_SECRET production`);
    console.log('\nOr: npm run configure:notify -- --apply');
    console.log('\nThen redeploy production.');
} else if (apply) {
    const secret =
        hasClient && hasServer && process.env.VITE_NOTIFY_SECRET.trim() === process.env.NOTIFY_SECRET.trim()
            ? process.env.VITE_NOTIFY_SECRET.trim()
            : randomBytes(24).toString('base64url');
    console.log('\nApplying notify secrets to Vercel production…');
    for (const name of ['NOTIFY_SECRET', 'VITE_NOTIFY_SECRET']) {
        const add = setVercelEnv(name, secret);
        if (add.status !== 0) {
            console.error(`Failed to set ${name}:`, add.stderr || add.stdout);
            process.exit(add.status);
        }
    }
    console.log('✅ NOTIFY_SECRET and VITE_NOTIFY_SECRET set (matching).');
    console.log('Redeploy: npx vercel deploy --prod --yes');
    process.exit(0);
} else if (!hasClient || !hasServer) {
    if (!onVercel) {
        console.log('\nGenerate a secret: npm run configure:notify -- --generate');
        console.log('Auto-apply on Vercel: npm run configure:notify -- --apply');
    }
}

if (vercelList && !onVercel) {
    console.log('\nℹ️  Vercel env names missing notify vars — add after generating a secret.');
}

const ok =
    (hasClient && hasServer && process.env.VITE_NOTIFY_SECRET.trim() === process.env.NOTIFY_SECRET.trim()) ||
    onVercel;

process.exit(ok ? 0 : 1);
