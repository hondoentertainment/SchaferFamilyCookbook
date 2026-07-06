#!/usr/bin/env node
/**
 * Audit Sentry configuration for production.
 *
 * Usage:
 *   npm run configure:sentry
 *   npm run configure:sentry -- --apply   # set VITE_SENTRY_DSN on Vercel when DSN is in env
 *
 * Set VITE_SENTRY_DSN in .env.local or pass before --apply:
 *   VITE_SENTRY_DSN=https://...@sentry.io/... npm run configure:sentry -- --apply
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

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

const dsn = process.env.VITE_SENTRY_DSN?.trim() ?? '';
const optional = [
    'VITE_SENTRY_TRACES_SAMPLE_RATE',
    'VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
].filter((k) => !process.env[k]?.trim());

console.log('Sentry configuration\n');

if (dsn) {
    console.log('✅ VITE_SENTRY_DSN present locally');
} else {
    console.log('❌ VITE_SENTRY_DSN missing — create a Sentry project and copy the DSN');
    console.log('   See Help → Troubleshooting → Send test event after configuring');
}

if (optional.length === 0) {
    console.log('✅ Optional Sentry vars present (traces, replay, source maps)');
} else {
    console.log('\nℹ️  Optional Sentry vars:');
    for (const k of optional) console.log(`   - ${k}`);
}

const vercelList = listVercelEnv();
const onVercel = vercelList?.includes('VITE_SENTRY_DSN') ?? false;
if (onVercel) {
    console.log('\n✅ VITE_SENTRY_DSN name exists on Vercel (encrypted values not shown in pull)');
} else if (vercelList) {
    console.log('\n❌ VITE_SENTRY_DSN not set on Vercel production');
}

if (apply) {
    if (!dsn) {
        console.log('\nℹ️  Skipping --apply (VITE_SENTRY_DSN not in .env.local)');
    } else {
        console.log('\nApplying VITE_SENTRY_DSN to Vercel production…');
        const add = setVercelEnv('VITE_SENTRY_DSN', dsn);
        if (add.status !== 0) {
            console.error('Failed:', add.stderr || add.stdout);
            process.exit(1);
        }
        console.log('✅ VITE_SENTRY_DSN set. Redeploy: npx vercel deploy --prod --yes');
    }
}

process.exit(dsn ? 0 : 1);
