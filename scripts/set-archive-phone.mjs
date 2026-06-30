#!/usr/bin/env node
/**
 * Write the Twilio MMS archive phone to Firestore config/settings.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' npm run set:archive-phone -- +15551234567
 *   npm run configure:text-to-gallery -- +15551234567
 */
import admin from 'firebase-admin';

const phone = process.argv[2]?.trim();
if (!phone || !/^\+[1-9]\d{1,14}$/.test(phone)) {
    console.error('Usage: FIREBASE_SERVICE_ACCOUNT=<json> npm run set:archive-phone -- +15551234567');
    process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT to a Firebase service account JSON string.');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(raw);
} catch {
    console.error('FIREBASE_SERVICE_ACCOUNT must be valid JSON');
    process.exit(1);
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();
await db.doc('config/settings').set({ archivePhone: phone }, { merge: true });
console.log(`✅ archivePhone set to ${phone} in config/settings`);
