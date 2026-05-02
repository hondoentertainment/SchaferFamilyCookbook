#!/usr/bin/env node
/**
 * Production smoke test. Fetches Vercel and GitHub Pages URLs and verifies
 * they return 200 and contain expected content. Run: npm run smoke:prod
 */
const URLS = [
  { url: 'https://schafer-family-cookbook.vercel.app', name: 'Vercel' },
  { url: 'https://hondoentertainment.github.io/SchaferFamilyCookbook/', name: 'GitHub Pages' },
];

/** Seed recipe ID from `src/data/recipes.json` — OG/share routes exist on Vercel only. */
const SAMPLE_RECIPE_ID = '749d8765';

const EXPECTED = 'Schafer Family Cookbook';

async function smokeVercelShareRoutes(vercelBase) {
  const shareUrl = `${vercelBase.replace(/\/$/, '')}/share/recipe/${SAMPLE_RECIPE_ID}`;
  const ogUrl = `${vercelBase.replace(/\/$/, '')}/api/og?recipeId=${encodeURIComponent(SAMPLE_RECIPE_ID)}`;

  for (const { url, name, kind } of [
    { url: shareUrl, name: 'Vercel share HTML', kind: 'html' },
    { url: ogUrl, name: 'Vercel OG PNG', kind: 'png' },
  ]) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        console.error(`❌ ${name} (${url}): HTTP ${res.status}`);
        return 1;
      }
      if (kind === 'html') {
        const html = await res.text();
        if (!html.includes('og:image') || !html.includes('/api/og?recipeId=')) {
          console.error(`❌ ${name}: missing expected Open Graph markup`);
          return 1;
        }
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if ((buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47)) {
          console.error(`❌ ${name}: response is not a PNG`);
          return 1;
        }
      }
      console.log(`✅ ${name}`);
    } catch (err) {
      console.error(`❌ ${name} (${url}): ${err.message}`);
      return 1;
    }
  }
  return 0;
}

async function smoke() {
  let failed = 0;
  const vercel = URLS.find((u) => u.name === 'Vercel');

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

  if (vercel) {
    failed += await smokeVercelShareRoutes(vercel.url);
  }

  process.exit(failed > 0 ? 1 : 0);
}

smoke();
