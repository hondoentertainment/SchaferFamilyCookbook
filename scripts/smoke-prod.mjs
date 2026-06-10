#!/usr/bin/env node
/**
 * Production smoke test. Fetches Vercel and GitHub Pages URLs and verifies
 * they return 200 and contain expected content. Run: npm run smoke:prod
 */
import fs from 'node:fs';

const URLS = [
  { url: 'https://schafer-family-cookbook.vercel.app', name: 'Vercel' },
  { url: 'https://hondoentertainment.github.io/SchaferFamilyCookbook/', name: 'GitHub Pages' },
];

/** Seed recipe ID from `src/data/recipes.json` — OG/share routes exist on Vercel only. */
const SAMPLE_RECIPE_ID = '749d8765';

const EXPECTED = 'Schafer Family Cookbook';
const recipes = JSON.parse(fs.readFileSync(new URL('../src/data/recipes.json', import.meta.url), 'utf8'));
const sampleRecipe = recipes.find((recipe) => recipe.id === SAMPLE_RECIPE_ID) ?? recipes[0];

function isRecognizedImageContentType(contentType) {
  return /image\/(avif|gif|jpeg|jpg|png|webp)/i.test(contentType ?? '');
}

async function smokeRecipeImageAsset(siteBase, siteName) {
  if (!sampleRecipe?.image || !sampleRecipe.image.startsWith('/')) {
    console.error(`❌ ${siteName} recipe image: sample recipe has no site-relative image path`);
    return 1;
  }

  const imageUrl = new URL(sampleRecipe.image.replace(/^\//, ''), `${siteBase.replace(/\/$/, '')}/`).toString();
  try {
    const res = await fetch(imageUrl, { redirect: 'follow' });
    if (!res.ok) {
      console.error(`❌ ${siteName} recipe image (${imageUrl}): HTTP ${res.status}`);
      return 1;
    }
    const contentType = res.headers.get('content-type') ?? '';
    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (!isRecognizedImageContentType(contentType)) {
      console.error(`❌ ${siteName} recipe image (${imageUrl}): unexpected content-type ${contentType}`);
      return 1;
    }
    if (contentLength > 0 && contentLength < 1024) {
      console.error(`❌ ${siteName} recipe image (${imageUrl}): unexpectedly small image (${contentLength} bytes)`);
      return 1;
    }
    console.log(`✅ ${siteName} recipe image (${sampleRecipe.image})`);
    return 0;
  } catch (err) {
    console.error(`❌ ${siteName} recipe image (${imageUrl}): ${err.message}`);
    return 1;
  }
}

async function smokeVercelPing(vercelBase) {
  const pingUrl = `${vercelBase.replace(/\/$/, '')}/api/ping`;
  const name = 'Vercel /api/ping';

  try {
    const res = await fetch(pingUrl, { redirect: 'follow' });
    const contentType = res.headers.get('content-type') ?? '';
    const body = (await res.text()).trim();

    if (!res.ok) {
      console.error(`❌ ${name} (${pingUrl}): HTTP ${res.status}`);
      return 1;
    }
    if (body !== 'ok') {
      console.error(`❌ ${name}: expected body "ok", got "${body}"`);
      return 1;
    }
    if (!contentType.includes('text/plain')) {
      console.error(`❌ ${name}: expected content-type text/plain, got "${contentType}"`);
      return 1;
    }
    console.log(`✅ ${name}`);
    return 0;
  } catch (err) {
    console.error(`❌ ${name} (${pingUrl}): ${err.message}`);
    return 1;
  }
}

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

    failed += await smokeRecipeImageAsset(url, name);
  }

  if (vercel) {
    failed += await smokeVercelPing(vercel.url);
    failed += await smokeVercelShareRoutes(vercel.url);
  }

  process.exit(failed > 0 ? 1 : 0);
}

smoke();
