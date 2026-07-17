#!/usr/bin/env node
/**
 * Final launch orchestrator — runs every automatable step to ship the family site.
 *
 * Usage:
 *   npm run finalize              # audit + smoke + CI coverage self-check
 *   npm run finalize -- --apply   # push local env vars to Vercel (when in .env.local)
 *   npm run finalize -- --deploy  # Vercel production deploy
 *   npm run finalize -- --migrate --yes   # live Firestore contributor migration
 *   npm run finalize -- --all     # apply + migrate dry-run + deploy + lighthouse
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const args = new Set(process.argv.slice(2));
const all = args.has('--all');
const apply = all || args.has('--apply');
const deploy = all || args.has('--deploy');
const migrate = all || args.has('--migrate');
const migrateLive = args.has('--yes');
const lighthouse = all || args.has('--lighthouse');
const skipCi = args.has('--skip-ci');

const blocked = [];
const manual = [];

function run(label, script, scriptArgs = [], { allowFail = false } = {}) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync(process.execPath, [join(root, 'scripts', script), ...scriptArgs], {
        stdio: 'inherit',
        shell: false,
        cwd: root,
    });
    const code = r.status ?? 1;
    if (code !== 0) {
        if (allowFail) blocked.push(label);
        else {
            console.error(`\n✖ ${label} failed (exit ${code})`);
            process.exit(code);
        }
    }
    return code;
}

function npmRun(label, script, { allowFail = false } = {}) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true, cwd: root });
    const code = r.status ?? 1;
    if (code !== 0) {
        if (allowFail) blocked.push(label);
        else {
            console.error(`\n✖ ${label} failed (exit ${code})`);
            process.exit(code);
        }
    }
    return code;
}

function shell(label, command, { allowFail = false } = {}) {
    console.log(`\n━━━ ${label} ━━━`);
    const r = spawnSync(command, { stdio: 'inherit', shell: true, cwd: root });
    const code = r.status ?? 1;
    if (code !== 0 && !allowFail) {
        console.error(`\n✖ ${label} failed (exit ${code})`);
        process.exit(code);
    }
    if (code !== 0) blocked.push(label);
    return code;
}

function trackCredential(name, envKey, docHint) {
    if (!process.env[envKey]?.trim()) {
        manual.push(`${name} — set ${envKey} in .env.local → npm run finalize -- --apply`);
    }
}

console.log('Finalize launch — full family site readiness\n');

if (!skipCi) {
    npmRun('CI coverage self-check', 'test:coverage');
}

run('Ops verify', 'verify-ops.mjs');
run('Notify', 'configure-notify.mjs', [], { allowFail: true });
run('Sentry', 'configure-sentry.mjs', [], { allowFail: true });
run('FCM', 'configure-fcm.mjs', [], { allowFail: true });
run('App Check', 'configure-app-check.mjs', [], { allowFail: true });
run('Text-to-gallery', 'configure-text-to-gallery.mjs', [], { allowFail: true });

trackCredential('Sentry', 'VITE_SENTRY_DSN', 'sentry.io');
trackCredential('FCM sender ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'Firebase Console');
trackCredential('FCM app ID', 'VITE_FIREBASE_APP_ID', 'Firebase Console');
trackCredential('FCM VAPID', 'VITE_FCM_VAPID_KEY', 'Firebase Console');
trackCredential('App Check', 'VITE_FIREBASE_APP_CHECK_SITE_KEY', 'Firebase App Check');
trackCredential('Contributor migration', 'FIREBASE_SERVICE_ACCOUNT', 'Firebase service account JSON');
trackCredential('Twilio SID', 'TWILIO_ACCOUNT_SID', 'Twilio console');
trackCredential('Archive phone', 'VITE_ARCHIVE_PHONE', 'E.164 gallery MMS number');

if (apply) {
    run('Apply notify secrets', 'configure-notify.mjs', ['--apply'], { allowFail: true });
    run('Apply Sentry DSN', 'configure-sentry.mjs', ['--apply'], { allowFail: true });
    run('Apply FCM vars', 'configure-fcm.mjs', ['--apply'], { allowFail: true });
    run('Apply App Check', 'configure-app-check.mjs', ['--apply'], { allowFail: true });

    if (process.env.VITE_ARCHIVE_PHONE?.trim()) {
        run('Apply archive phone (client)', 'lib/apply-vercel-env-batch.mjs', ['VITE_ARCHIVE_PHONE'], {
            allowFail: true,
        });
    }
}

if (migrate) {
    run('Contributor migration dry-run', 'normalize-contributor-names-firestore.mjs', ['--dry-run'], {
        allowFail: true,
    });
    if (migrateLive && process.env.FIREBASE_SERVICE_ACCOUNT?.trim()) {
        run('Contributor migration (live)', 'normalize-contributor-names-firestore.mjs', []);
    } else if (migrateLive) {
        blocked.push('Contributor migration (live) — FIREBASE_SERVICE_ACCOUNT missing locally');
    }
}

if (deploy) {
    shell('Vercel production deploy', 'npx vercel deploy --prod --yes', { allowFail: true });
}

npmRun('Production smoke test', 'smoke:prod');

if (lighthouse) {
    npmRun('Lighthouse CI', 'lighthouse:ci', { allowFail: true });
}

console.log('\n━━━ Manual launch walkthrough ━━━');
console.log('1. Open https://schafer-family-cookbook.vercel.app as a family member (not custodian)');
console.log('2. Gallery → Share a memory → upload a test photo');
console.log('3. Custodian: Admin → Gallery → approve the pending item');
console.log('4. Confirm photo is public; optional: verify push if FCM vars are set');
console.log('5. Share a recipe link in iMessage/Slack — confirm OG image preview');
console.log('6. Help → Troubleshooting → Send Sentry test event (after DSN configured)');

console.log('\n━━━ Summary ━━━');
if (blocked.length === 0) {
    console.log('✔ All automated finalize steps completed.');
} else {
    console.log('⚠️  Automated steps needing attention:');
    for (const item of blocked) console.log(`   - ${item}`);
}

if (manual.length > 0) {
    console.log('\n📋 Credentials to add in .env.local, then re-run with --apply --deploy:');
    for (const item of manual) console.log(`   - ${item}`);
}

process.exit(blocked.length > 0 || manual.length > 0 ? 1 : 0);
