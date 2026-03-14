#!/usr/bin/env node
/**
 * Production smoke test. Fetches Vercel and GitHub Pages URLs and verifies
 * they return 200 and contain expected content. Run: npm run smoke:prod
 */
const URLS = [
  { url: 'https://schafer-family-cookbook.vercel.app', name: 'Vercel' },
  { url: 'https://hondoentertainment.github.io/SchaferFamilyCookbook/', name: 'GitHub Pages' },
];

const EXPECTED = 'Schafer Family Cookbook';

async function smoke() {
  let failed = 0;
  for (const { url, name } of URLS) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const html = await res.text();
      if (!res.ok) {
        console.error(`❌ ${name} (${url}): HTTP ${res.status}`);
        failed++;
      } else if (!html.includes(EXPECTED)) {
        console.error(`❌ ${name} (${url}): missing expected content "${EXPECTED}"`);
        failed++;
      } else {
        console.log(`✅ ${name} (${url})`);
      }
    } catch (err) {
      console.error(`❌ ${name} (${url}): ${err.message}`);
      failed++;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

smoke();
