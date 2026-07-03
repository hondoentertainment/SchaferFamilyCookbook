#!/usr/bin/env node
/**
 * Ensure VITE_GALLERY_UPLOADS_ENABLED=true on Vercel production.
 * Run: npm run fix:gallery-uploads-env
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args, input) {
    const r = spawnSync(cmd, args, {
        encoding: 'utf8',
        shell: true,
        input,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

console.log('Setting VITE_GALLERY_UPLOADS_ENABLED=true on Vercel production…\n');

run('npx', ['vercel', 'env', 'rm', 'VITE_GALLERY_UPLOADS_ENABLED', 'production', '--yes']);

const add = run('npx', ['vercel', 'env', 'add', 'VITE_GALLERY_UPLOADS_ENABLED', 'production'], 'true\n');

if (add.status !== 0) {
    console.error('Failed to set env var:', add.stderr || add.stdout);
    process.exit(add.status);
}

console.log('✅ VITE_GALLERY_UPLOADS_ENABLED=true set on production.');
console.log('Redeploy for the change to take effect: npx vercel deploy --prod --yes');
