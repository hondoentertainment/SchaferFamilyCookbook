#!/usr/bin/env node
/**
 * Combined ops checklist: Vercel env names + Firebase Storage readiness.
 * Run: npm run verify:ops
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

function runScript(name, script) {
    console.log(`\n── ${name} ──`);
    const r = spawnSync(process.execPath, [join(root, script)], {
        stdio: 'inherit',
        shell: false,
    });
    return r.status ?? 1;
}

let failed = 0;
if (runScript('Vercel env audit', 'verify-vercel-env.mjs') !== 0) failed++;

console.log('\n── Firebase Storage ──');
const storage = spawnSync(process.execPath, [join(root, 'verify-storage.mjs')], {
    encoding: 'utf8',
    shell: false,
});
if (storage.status === 0) {
    console.log(storage.stdout?.trim() || '✅ Storage OK');
} else {
    console.log(storage.stdout?.trim() || storage.stderr?.trim() || 'Storage check failed');
    failed++;
}

console.log(failed === 0 ? '\n✔ All ops checks passed.' : '\n⚠️  Some ops checks need attention (see above).');
process.exit(failed > 0 ? 1 : 0);
