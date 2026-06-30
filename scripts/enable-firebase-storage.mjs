#!/usr/bin/env node
/**
 * Create the Firebase default Storage bucket (console "Get Started" equivalent).
 * Uses the same OAuth token as the Firebase CLI.
 *
 * Usage: node scripts/enable-firebase-storage.mjs [location]
 * Default location: us-central1
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'schafer-cookbook';
const location = process.argv[2] || 'us-central1';

function getFirebaseAccessToken() {
    const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const token = config?.tokens?.access_token;
    if (!token) {
        throw new Error('No Firebase CLI access token. Run: firebase login');
    }
    return token;
}

const token = getFirebaseAccessToken();
const url = `https://firebasestorage.googleapis.com/v1alpha/projects/${PROJECT}/defaultBucket`;

const res = await fetch(url, {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ location }),
});

const body = await res.text();
let parsed;
try {
    parsed = JSON.parse(body);
} catch {
    parsed = body;
}

if (!res.ok) {
    console.error(`❌ Failed to create default bucket (${res.status})`);
    console.error(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
    if (res.status === 403 && JSON.stringify(parsed).includes('Blaze')) {
        console.error('\nUpgrade the project to the Blaze plan:');
        console.error(`https://console.firebase.google.com/project/${PROJECT}/usage/details`);
    }
    process.exit(1);
}

console.log(`✅ Default Storage bucket created for ${PROJECT} (${location})`);
console.log(JSON.stringify(parsed, null, 2));
