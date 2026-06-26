#!/usr/bin/env node
/**
 * Check that required Vercel production env var *names* exist.
 * Run: npm run verify:vercel-env
 *
 * Does not print secret values — only reports missing keys.
 */
import { spawnSync } from 'node:child_process';

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

const missingSentryBuild = SENTRY_BUILD.filter((k) => !names.has(k));
if (missingSentryBuild.length > 0 && names.has('VITE_SENTRY_DSN')) {
  console.log('\nℹ️  Sentry source maps (optional — readable stack traces in production):');
  for (const k of missingSentryBuild) console.log(`   - ${k}`);
}

if (missingPush.length > 0) {
  console.log('\nℹ️  Push notifications (optional — see docs/FIREBASE_PUSH_NOTIFICATIONS.md):');
  for (const k of missingPush) console.log(`   - ${k}`);
}

const misnamed = [...names].filter((n) => n.startsWith('AIza'));
if (misnamed.length > 0) {
  console.log('\n❌ Misnamed env vars (delete and use VITE_FIREBASE_API_KEY):');
  for (const k of misnamed) console.log(`   - ${k}`);
  console.log('   Run: npx vercel env rm <name> production preview development');
}

const exitCode = missingRequired.length > 0 || misnamed.length > 0 ? 1 : 0;
process.exit(exitCode);
