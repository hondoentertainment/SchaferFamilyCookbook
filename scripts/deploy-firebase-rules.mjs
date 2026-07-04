#!/usr/bin/env node
/**
 * Deploy Firestore + Storage security rules to the Schafer Firebase project.
 *
 * Usage: npm run deploy:firebase-rules
 *
 * Prerequisite: Firebase Storage must be enabled in the console if gallery
 * uploads use client-side Storage (see Help → Custodian ops checklist).
 */
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'schafer-cookbook';

function run(args) {
  const label = `firebase ${args.join(' ')}`;
  console.log(`\n› ${label}`);
  const result = spawnSync('firebase', args, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

console.log(`━━━ Deploy Firebase rules (${PROJECT}) ━━━`);

const firestoreStatus = run([
  'deploy',
  '--only',
  'firestore:rules',
  '--project',
  PROJECT,
]);

if (firestoreStatus !== 0) {
  process.exit(firestoreStatus);
}

const storageStatus = run([
  'deploy',
  '--only',
  'storage',
  '--project',
  PROJECT,
]);

if (storageStatus !== 0) {
  console.error(`
⚠️  Storage rules were not deployed.
   Enable Firebase Storage first:
   https://console.firebase.google.com/project/${PROJECT}/storage
   Then re-run: npm run deploy:firebase-rules
`);
  process.exit(storageStatus);
}

console.log('\n✔ Firestore and Storage rules deployed.');
