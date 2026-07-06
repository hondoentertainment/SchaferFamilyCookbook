#!/usr/bin/env node
/**
 * Run the recommended next-steps checklist (audits, optional apply, smoke).
 *
 * Usage:
 *   npm run next-steps
 *   npm run next-steps -- --apply     # also apply notify secrets on Vercel
 *   npm run next-steps -- --lighthouse
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const lighthouse = process.argv.includes('--lighthouse');

function run(label, script, args = [], { allowFail = false } = {}) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
        stdio: 'inherit',
        shell: false,
        cwd: root,
    });
    const code = r.status ?? 1;
    if (code !== 0 && !allowFail) {
        console.error(`\n✖ ${label} failed (exit ${code})`);
        process.exit(code);
    }
    return code;
}

function npmRun(label, script, { allowFail = false } = {}) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true, cwd: root });
    const code = r.status ?? 1;
    if (code !== 0 && !allowFail) {
        console.error(`\n✖ ${label} failed (exit ${code})`);
        process.exit(code);
    }
    return code;
}

console.log('Next steps checklist\n');

run('Ops verify', 'verify-ops.mjs');
run('Notify audit', 'configure-notify.mjs', [], { allowFail: true });
run('Sentry audit', 'configure-sentry.mjs', [], { allowFail: true });
run('FCM audit', 'configure-fcm.mjs', [], { allowFail: true });
run('App Check audit', 'configure-app-check.mjs', [], { allowFail: true });
run('Text-to-gallery audit', 'configure-text-to-gallery.mjs', [], { allowFail: true });
run('Contributor migration dry-run', 'normalize-contributor-names-firestore.mjs', ['--dry-run'], {
    allowFail: true,
});

if (apply) {
    run('Apply notify secrets', 'configure-notify.mjs', ['--apply'], { allowFail: true });
    run('Apply Sentry DSN (if in .env.local)', 'configure-sentry.mjs', ['--apply'], { allowFail: true });
    run('Apply FCM vars (if in .env.local)', 'configure-fcm.mjs', ['--apply'], { allowFail: true });
    run('Apply App Check (if in .env.local)', 'configure-app-check.mjs', ['--apply'], { allowFail: true });
}

npmRun('Production smoke test', 'smoke:prod');

if (lighthouse) {
    npmRun('Lighthouse CI', 'lighthouse:ci', { allowFail: true });
}

console.log('\n✔ Next-steps run complete.');
console.log('  Full pass: npm run productionize -- --all');
console.log('  Manual: live gallery test on prod, credentials in .env.local for Sentry/FCM/App Check/migration');
