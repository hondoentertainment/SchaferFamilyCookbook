#!/usr/bin/env node
/**
 * Verify Firebase Storage is enabled and rules can deploy.
 * Run: npm run verify:storage
 */
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'schafer-cookbook';

const result = spawnSync(
    'firebase',
    ['deploy', '--only', 'storage', '--project', PROJECT],
    { encoding: 'utf8', shell: true },
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

if (result.status === 0) {
    console.log('✅ Firebase Storage is enabled and rules deployed.');
    process.exit(0);
}

if (output.includes('has not been set up')) {
    console.log('❌ Firebase Storage is not enabled.');
    console.log(`   Enable it: https://console.firebase.google.com/project/${PROJECT}/storage`);
    console.log('   Then run: npm run deploy:firebase-rules');
    process.exit(1);
}

console.error('❌ Storage verification failed:\n', output);
process.exit(result.status ?? 1);
