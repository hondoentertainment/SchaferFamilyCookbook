#!/usr/bin/env node
/** Apply one or more env vars from process.env to Vercel production. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalOpsEnv } from '../load-local-env.mjs';
import { applyVercelEnvVars } from './vercel-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
loadLocalOpsEnv(root);

const names = process.argv.slice(2).filter(Boolean);
if (names.length === 0) {
    console.error('Usage: node scripts/lib/apply-vercel-env-batch.mjs VAR1 VAR2 ...');
    process.exit(1);
}

const result = applyVercelEnvVars(names);
if (!result.ok) {
    console.error(`Failed to set ${result.failed}`);
    process.exit(1);
}
if (result.applied.length > 0) console.log(`✅ Applied: ${result.applied.join(', ')}`);
if (result.skipped.length > 0) console.log(`ℹ️  Skipped: ${result.skipped.join(', ')}`);
