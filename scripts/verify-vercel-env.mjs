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

// Flag misnamed vars (raw API key used as name)
const misnamed = [...names].filter((n) => n.startsWith('AIza'));
if (misnamed.length > 0) {
  console.log('\n⚠️  Misnamed env vars (rename to VITE_FIREBASE_API_KEY):');
  for (const k of misnamed) console.log(`   - ${k}`);
}

process.exit(missingRequired.length > 0 ? 1 : 0);
