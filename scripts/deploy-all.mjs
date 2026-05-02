#!/usr/bin/env node
/**
 * One-step production deploy: commits any pending changes, pushes to GitHub
 * `main` (which triggers the GitHub Pages workflow), then deploys to Vercel
 * production. Finishes with a smoke test against both live URLs.
 *
 * Usage:
 *   npm run deploy                    -> auto-generated commit message
 *   npm run deploy -- "your message"  -> custom commit message
 *   npm run deploy -- --skip-smoke    -> skip the smoke test at the end
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const skipSmoke = args.includes('--skip-smoke');
const messageArg = args.filter((a) => !a.startsWith('--')).join(' ').trim() || undefined;

function run(cmd, cmdArgs, opts = {}) {
  const label = `${cmd} ${cmdArgs.join(' ')}`;
  console.log(`\n› ${label}`);
  const result = spawnSync(cmd, cmdArgs, {
    stdio: opts.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    // Avoid shell on Windows so spaces in `git commit -m "..."` stay one argument.
    shell: false,
    encoding: 'utf8',
    ...opts,
  });
  if (result.status !== 0) {
    if (opts.allowFail) return result;
    console.error(`\n✖ Command failed: ${label}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

function capture(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { shell: false, encoding: 'utf8' });
  return (r.stdout ?? '').trim();
}

console.log('━━━ Deploying to GitHub + Vercel production ━━━');

const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  console.error(`\n✖ Refusing to deploy from branch "${branch}". Switch to "main" first.`);
  process.exit(1);
}

const dirty = capture('git', ['status', '--porcelain']);
if (dirty) {
  console.log('\n• Uncommitted changes detected — staging and committing.');
  run('git', ['add', '-A']);
  const message = messageArg || `chore(deploy): production release ${new Date().toISOString()}`;
  run('git', ['commit', '-m', message]);
} else {
  console.log('\n• Working tree clean — nothing new to commit.');
}

run('git', ['push', 'origin', 'main']);

run('npx', ['vercel', 'deploy', '--prod', '--yes']);

if (!skipSmoke) {
  run('node', ['scripts/smoke-prod.mjs'], { allowFail: true });
}

console.log('\n✔ Deploy complete.');
console.log('  GitHub Pages: https://hondoentertainment.github.io/SchaferFamilyCookbook/');
console.log('  Vercel:       https://schafer-family-cookbook.vercel.app');
