#!/usr/bin/env node
/**
 * Check that required Vercel production env var *names* exist.
 * Run: npm run verify:vercel-env
 *
 * Does not print secret values — only reports missing keys.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';

const REQUIRED_PRODUCTION = [
  'GEMINI_API_KEY',
  'TWILIO_AUTH_TOKEN',
  'VITE_SHARE_BASE',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
];

const RECOMMENDED = [
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_SENTRY_DSN',
  'VITE_GALLERY_UPLOADS_ENABLED',
];

/** Required for Twilio MMS → gallery webhook (server-side). */
const TEXT_TO_GALLERY = [
  'FIREBASE_SERVICE_ACCOUNT',
  'TWILIO_AUTH_TOKEN',
];

const TEXT_TO_GALLERY_RECOMMENDED = [
  'TWILIO_ACCOUNT_SID',
  'VITE_ARCHIVE_PHONE',
];

const SENTRY_BUILD = [
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];

const OPTIONAL_PUSH = [
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FCM_VAPID_KEY',
];

const OPTIONAL_APP_CHECK = ['VITE_FIREBASE_APP_CHECK_SITE_KEY'];

const OPTIONAL_NOTIFY = ['VITE_NOTIFY_SECRET', 'NOTIFY_SECRET'];

function listVercelEnv() {
  const r = spawnSync('npx', ['vercel', 'env', 'ls'], { encoding: 'utf8', shell: true });
  if (r.status !== 0) {
    console.error('Failed to run `vercel env ls`. Log in with `vercel login` first.');
    process.exit(r.status ?? 1);
  }
  return r.stdout ?? '';
}

const output = listVercelEnv();
const names = new Set(
  output
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name) => name && /^[A-Z0-9_]+$/.test(name)),
);

const missingRequired = REQUIRED_PRODUCTION.filter((k) => !names.has(k));
const missingRecommended = RECOMMENDED.filter((k) => !names.has(k));
const missingTextToGallery = TEXT_TO_GALLERY.filter((k) => !names.has(k));
const missingTextToGalleryRecommended = TEXT_TO_GALLERY_RECOMMENDED.filter((k) => !names.has(k));
const missingPush = OPTIONAL_PUSH.filter((k) => !names.has(k));

console.log('Vercel env audit (names only)\n');
console.log(`Found ${names.size} named variables.`);

if (missingRequired.length === 0) {
  console.log('✅ Required production vars present');
} else {
  console.log('❌ Missing required vars:');
  for (const k of missingRequired) console.log(`   - ${k}`);
}

if (missingRecommended.length > 0) {
  console.log('\n⚠️  Recommended (optional):');
  for (const k of missingRecommended) console.log(`   - ${k}`);
}

if (missingTextToGallery.length === 0) {
  console.log('\n✅ Text-to-gallery server vars present');
} else {
  console.log('\n❌ Text-to-gallery (Twilio MMS webhook) missing:');
  for (const k of missingTextToGallery) console.log(`   - ${k}`);
}

if (missingTextToGalleryRecommended.length > 0) {
  console.log('\nℹ️  Text-to-gallery (recommended):');
  for (const k of missingTextToGalleryRecommended) console.log(`   - ${k}`);
}

if (names.has('VITE_GALLERY_UPLOADS_ENABLED')) {
  const auditPath = '.env.vercel.audit.tmp';
  const pull = spawnSync('npx', ['vercel', 'env', 'pull', auditPath, '--environment=production', '--yes'], {
    encoding: 'utf8',
    shell: true,
  });
  if (pull.status === 0 && existsSync(auditPath)) {
    try {
      const auditRaw = readFileSync(auditPath, 'utf8');
      unlinkSync(auditPath);
      const match = auditRaw.match(/^VITE_GALLERY_UPLOADS_ENABLED=(.*)$/m);
      const value = match?.[1]?.trim().replace(/^["']|["']$/g, '').replace(/\r$/, '');
      if (value === 'true') {
        console.log('\n✅ VITE_GALLERY_UPLOADS_ENABLED=true (gallery uploads enabled)');
      } else if (!value) {
        console.log('\n✅ VITE_GALLERY_UPLOADS_ENABLED is set on Vercel (encrypted — value not visible via env pull; redeploy after changes)');
      } else {
        console.log(`\n⚠️  VITE_GALLERY_UPLOADS_ENABLED is set but not "true" (got: ${value})`);
      }
    } catch {
      console.log('\n✅ VITE_GALLERY_UPLOADS_ENABLED is set (in-app gallery uploads)');
    }
  } else {
    console.log('\n✅ VITE_GALLERY_UPLOADS_ENABLED is set (in-app gallery uploads)');
  }
}

const missingSentryBuild = SENTRY_BUILD.filter((k) => !names.has(k));
if (missingSentryBuild.length > 0 && names.has('VITE_SENTRY_DSN')) {
  console.log('\nℹ️  Sentry source maps (optional — readable stack traces in production):');
  for (const k of missingSentryBuild) console.log(`   - ${k}`);
}

if (missingPush.length > 0) {
  console.log('\nℹ️  Push notifications (optional — see docs/FIREBASE_PUSH_NOTIFICATIONS.md):');
  for (const k of missingPush) console.log(`   - ${k}`);
}

const missingAppCheck = OPTIONAL_APP_CHECK.filter((k) => !names.has(k));
if (missingAppCheck.length > 0) {
  console.log('\nℹ️  App Check (optional — see docs/FIREBASE_SECURITY.md):');
  for (const k of missingAppCheck) console.log(`   - ${k}`);
}

const missingNotify = OPTIONAL_NOTIFY.filter((k) => !names.has(k));
if (missingNotify.length > 0) {
  console.log('\nℹ️  Push notify (optional — gallery approve + admin broadcast):');
  for (const k of missingNotify) console.log(`   - ${k}`);
}

const misnamed = [...names].filter((n) => n.startsWith('AIza'));
if (misnamed.length > 0) {
  console.log('\n❌ Misnamed env vars (delete and use VITE_FIREBASE_API_KEY):');
  for (const k of misnamed) console.log(`   - ${k}`);
  console.log('   Run: npx vercel env rm <name> production preview development');
}

const exitCode = missingRequired.length > 0 || missingTextToGallery.length > 0 || misnamed.length > 0 ? 1 : 0;
process.exit(exitCode);
