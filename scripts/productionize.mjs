#!/usr/bin/env node
/**
 * Production readiness orchestrator — runs every automated next step.
 *
 * Usage:
 *   npm run productionize              # audit + smoke
 *   npm run productionize -- --apply   # push local env vars to Vercel (when set)
 *   npm run productionize -- --deploy    # Vercel production deploy after apply
 *   npm run productionize -- --migrate   # contributor dry-run; live with --yes
 *   npm run productionize -- --lighthouse
 *   npm run productionize -- --all       # apply + migrate (dry-run) + deploy + lighthouse
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

const blocked = [];

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

console.log('Productionize — full readiness pass\n');

run('Ops verify', 'verify-ops.mjs');
run('Notify', 'configure-notify.mjs', [], { allowFail: true });
run('Sentry', 'configure-sentry.mjs', [], { allowFail: true });
run('FCM', 'configure-fcm.mjs', [], { allowFail: true });
run('App Check', 'configure-app-check.mjs', [], { allowFail: true });
run('Text-to-gallery', 'configure-text-to-gallery.mjs', [], { allowFail: true });

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
        blocked.push('Contributor migration (live) — FIREBASE_SERVICE_ACCOUNT missing');
    }
}

if (deploy) {
    shell('Vercel production deploy', 'npx vercel deploy --prod --yes', { allowFail: true });
}

npmRun('Production smoke test', 'smoke:prod');

if (lighthouse) {
    npmRun('Lighthouse CI', 'lighthouse:ci', { allowFail: true });
}

console.log('\n━━━ Summary ━━━');
if (blocked.length === 0) {
    console.log('✔ All automated productionize steps completed.');
} else {
    console.log('⚠️  Items needing credentials or manual action:');
    for (const item of blocked) console.log(`   - ${item}`);
}

console.log('\nManual (cannot automate):');
console.log('   - Live Firebase gallery upload test on production');
console.log('   - Sentry: create project → add VITE_SENTRY_DSN to .env.local → productionize --apply');
console.log('   - FCM: Firebase Console → add sender ID, app ID, VAPID → .env.local → productionize --apply');
console.log('   - App Check: reCAPTCHA v3 site key → .env.local → productionize --apply');
console.log('   - Contributor live migrate: FIREBASE_SERVICE_ACCOUNT in .env.local → productionize --migrate --yes');

process.exit(blocked.length > 0 ? 1 : 0);
