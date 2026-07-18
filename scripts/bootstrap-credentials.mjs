#!/usr/bin/env node
/**
 * Guided checklist for launch credentials that cannot be invented from code.
 *
 * Usage: npm run bootstrap:credentials
 *
 * Prints where to get each secret, validates values already in .env.local,
 * and shows the exact apply commands once filled in.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from './load-local-env.mjs';
import { listVercelEnvNames } from './lib/vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalOpsEnv(root);

const ITEMS = [
    {
        key: 'VITE_SENTRY_DSN',
        title: 'Sentry DSN',
        where: 'sentry.io → Create project (React) → Client Keys (DSN)',
        apply: 'npm run configure:sentry -- --apply',
        required: true,
    },
    {
        key: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
        title: 'FCM messaging sender ID',
        where: 'npm run configure:firebase-web (or Firebase Console → Your apps → messagingSenderId)',
        apply: 'npm run configure:firebase-web -- --apply',
        required: false,
    },
    {
        key: 'VITE_FIREBASE_APP_ID',
        title: 'FCM / Firebase app ID',
        where: 'npm run configure:firebase-web (or Firebase Console → Your apps → appId)',
        apply: 'npm run configure:firebase-web -- --apply',
        required: false,
    },
    {
        key: 'VITE_FCM_VAPID_KEY',
        title: 'FCM VAPID key',
        where: 'Firebase Console → Project settings → Cloud Messaging → Web Push certificates',
        apply: 'npm run configure:fcm -- --apply',
        required: false,
    },
    {
        key: 'VITE_FIREBASE_APP_CHECK_SITE_KEY',
        title: 'App Check reCAPTCHA v3 site key',
        where: 'Firebase Console → App Check → Register web app → reCAPTCHA v3',
        apply: 'npm run configure:app-check -- --apply',
        required: false,
    },
    {
        key: 'FIREBASE_SERVICE_ACCOUNT',
        title: 'Firebase service account JSON (one line)',
        where: 'Firebase Console → Project settings → Service accounts → Generate new private key',
        apply: 'npm run finalize -- --migrate --yes',
        required: false,
        validate: (v) => {
            try {
                const j = JSON.parse(v);
                return j.project_id && j.private_key ? null : 'JSON missing project_id/private_key';
            } catch {
                return 'Not valid JSON';
            }
        },
    },
    {
        key: 'TWILIO_ACCOUNT_SID',
        title: 'Twilio Account SID',
        where: 'Twilio Console → Account Info',
        apply: 'npm run configure:text-to-gallery',
        required: false,
    },
    {
        key: 'VITE_ARCHIVE_PHONE',
        title: 'Archive MMS phone (E.164)',
        where: 'Your Twilio number, e.g. +15551234567',
        apply: 'npm run set:archive-phone -- +1…',
        required: false,
        validate: (v) => (/^\+[1-9]\d{7,14}$/.test(v) ? null : 'Use E.164 like +15551234567'),
    },
];

console.log('Credential bootstrap — fill .env.local then re-run\n');

const vercelNames = listVercelEnvNames();
let missingRequired = 0;
let missingOptional = 0;

for (const item of ITEMS) {
    const value = process.env[item.key]?.trim() ?? '';
    const onVercel = vercelNames?.has(item.key) ?? false;
    let status;
    if (value) {
        const err = item.validate?.(value);
        status = err ? `❌ invalid — ${err}` : '✅ set locally';
    } else if (onVercel) {
        status = 'ℹ️  on Vercel (local copy missing — encrypted pull may omit value)';
    } else {
        status = item.required ? '❌ missing' : '⬜ optional / missing';
        if (item.required) missingRequired++;
        else missingOptional++;
    }
    console.log(`${status}  ${item.title} (${item.key})`);
    console.log(`         Get: ${item.where}`);
    console.log(`         Apply: ${item.apply}\n`);
}

console.log('── After filling .env.local ──');
console.log('  npm run finalize -- --apply --deploy');
console.log('  npm run finalize -- --migrate --yes   # if FIREBASE_SERVICE_ACCOUNT set');
console.log('\n── Manual walkthrough (cannot automate) ──');
console.log('  1. Family member uploads a Gallery photo on production');
console.log('  2. Custodian approves in Admin → Gallery');
console.log('  3. Add a Family Note → confirm on a second browser');
console.log('  4. Help → Send Sentry test event (after DSN)');

process.exit(missingRequired > 0 ? 1 : 0);
