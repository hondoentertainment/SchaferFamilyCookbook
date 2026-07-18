#!/usr/bin/env node
/**
 * Custodian launch runbook — automated checks + printed walkthrough.
 *
 * Usage:
 *   npm run custodian:runbook
 *   npm run custodian:runbook -- --check   # ops + smoke only (no coverage)
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const failed = [];

function run(label, cmd, args) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: root });
    if ((r.status ?? 1) !== 0) failed.push(label);
}

console.log('Custodian runbook\n');

run('Ops verify', process.execPath, [join(root, 'scripts', 'verify-ops.mjs')]);
run('Notify audit', process.execPath, [join(root, 'scripts', 'configure-notify.mjs')]);
run('Credential bootstrap', process.execPath, [join(root, 'scripts', 'bootstrap-credentials.mjs')]);
run('Production smoke', 'npm', ['run', 'smoke:prod']);

if (!checkOnly) {
    run('Firebase rules unit tests', 'npm', ['run', 'test:rules']);
}

console.log('\n━━━ Family launch walkthrough ━━━');
console.log('Site: https://schafer-family-cookbook.vercel.app');
console.log('1. Sign in as a non-custodian → Gallery → Share a memory → upload a test photo');
console.log('2. Sign in as custodian → Profile → Open Admin Tools → Gallery → Approve');
console.log('3. Confirm the photo is public in Gallery (and contributor filter)');
console.log('4. Open a recipe → add a Family Note → check a second browser/device');
console.log('5. Recipes hero → Print the family cookbook → browser Print → PDF');
console.log('6. Share a recipe link in iMessage/Slack → confirm OG image card');
console.log('7. After Sentry DSN: Help → Troubleshooting → Send Sentry test event');
console.log('8. Optional: enable push (FCM vars) → approve another gallery item → receive notify');

console.log('\n━━━ Summary ━━━');
if (failed.length === 0) {
    console.log('✔ Automated checks passed. Complete the walkthrough above before family launch.');
} else {
    console.log('⚠️  Failed checks:');
    for (const f of failed) console.log(`   - ${f}`);
}

process.exit(failed.length > 0 ? 1 : 0);
