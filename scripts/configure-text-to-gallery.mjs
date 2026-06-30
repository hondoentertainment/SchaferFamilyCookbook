#!/usr/bin/env node
/**
 * Text-to-gallery readiness audit and optional bootstrap.
 *
 * Usage:
 *   npm run configure:text-to-gallery
 *   npm run configure:text-to-gallery -- +15551234567
 *   FIREBASE_SERVICE_ACCOUNT='...' TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... npm run configure:text-to-gallery
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const phoneArg = process.argv[2]?.trim();

function ok(msg) {
    console.log(`✅ ${msg}`);
}

function warn(msg) {
    console.log(`⚠️  ${msg}`);
}

function fail(msg) {
    console.log(`❌ ${msg}`);
}

console.log('Text-to-gallery configuration\n');

const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const firebaseSa = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
const archivePhone = process.env.VITE_ARCHIVE_PHONE?.trim() || phoneArg;

if (twilioToken) ok('TWILIO_AUTH_TOKEN is set');
else fail('TWILIO_AUTH_TOKEN missing — add in Vercel for webhook signature validation');

if (firebaseSa) ok('FIREBASE_SERVICE_ACCOUNT is set');
else fail('FIREBASE_SERVICE_ACCOUNT missing — webhook cannot upload to Firebase');

if (twilioSid) ok('TWILIO_ACCOUNT_SID is set (needed to download MMS media from Twilio)');
else warn('TWILIO_ACCOUNT_SID missing — add on Vercel so /api/webhook can fetch MMS attachments');

if (archivePhone) {
    ok(`Archive phone configured: ${archivePhone}`);
} else {
    warn('No archive phone yet — set VITE_ARCHIVE_PHONE on Vercel or pass E.164 number as an argument');
}

if (twilioSid && twilioToken && !archivePhone) {
    try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/IncomingPhoneNumbers.json?PageSize=5', {
            headers: { Authorization: `Basic ${auth}` },
        });
        if (res.ok) {
            const data = await res.json();
            const numbers = (data.incoming_phone_numbers || []).map((n) => n.phone_number);
            if (numbers.length > 0) {
                console.log('\nTwilio numbers on this account:');
                for (const n of numbers) console.log(`   ${n}`);
                console.log('\nPick one and run:');
                console.log(`   npm run set:archive-phone -- ${numbers[0]}`);
                console.log(`   npx vercel env add VITE_ARCHIVE_PHONE production   # paste ${numbers[0]}`);
            }
        }
    } catch (error) {
        warn(`Could not list Twilio numbers: ${error instanceof Error ? error.message : error}`);
    }
}

console.log('\n── Firebase Storage ──');
const storage = spawnSync(process.execPath, [join(root, 'verify-storage.mjs')], {
    encoding: 'utf8',
    shell: false,
});
if (storage.status === 0) {
    ok('Firebase Storage is ready');
} else {
    console.log((storage.stdout || storage.stderr || '').trim());
}

console.log('\n── Twilio webhook ──');
console.log('   URL: https://schafer-family-cookbook.vercel.app/api/webhook (POST)');
console.log('   See TWILIO_SETUP.md for console steps');

if (phoneArg && firebaseSa) {
    console.log('\n── Writing Firestore config/settings ──');
    const setPhone = spawnSync(
        process.execPath,
        [join(root, 'set-archive-phone.mjs'), phoneArg],
        { stdio: 'inherit', shell: false, env: process.env },
    );
    process.exit(setPhone.status ?? 1);
}

console.log('\nWhen all checks pass, redeploy Vercel so VITE_ARCHIVE_PHONE is baked into the client bundle.');
