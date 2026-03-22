/**
 * Grant Firestore/Storage write access (custom claim admin: true) to a Firebase Auth user.
 *
 * Prerequisites:
 * - FIREBASE_SERVICE_ACCOUNT env: JSON string of a Firebase service account key
 * - User must have signed in once (e.g. Google) so they appear in Firebase Console → Authentication
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' npm run admin:set-claim -- <uid>
 *
 * Find UID: Firebase Console → Authentication → Users, or after custodian signs in on the site.
 */
import admin from 'firebase-admin';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
const uid = process.argv[2];

if (!raw || !uid) {
    console.error('Usage: FIREBASE_SERVICE_ACCOUNT=<json> npm run admin:set-claim -- <firebase-auth-uid>');
    process.exit(1);
}

let sa;
try {
    sa = JSON.parse(raw);
} catch {
    console.error('FIREBASE_SERVICE_ACCOUNT must be valid JSON');
    process.exit(1);
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
    });
}

await admin.auth().setCustomUserClaims(uid, { admin: true });
console.log('Set custom claim admin:true for uid:', uid);
