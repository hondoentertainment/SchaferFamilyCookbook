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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GitHub Pages often returns 502/503 while a deploy is propagating. */
async function fetchWithRetry(url, { attempts = 5, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok || (res.status !== 502 && res.status !== 503 && res.status !== 429)) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await sleep(baseDelayMs * (i + 1));
  }
  throw lastErr ?? new Error('fetch failed');
}

async function smokeRecipeImageAsset(siteBase, siteName) {
  if (!sampleRecipe?.image || !sampleRecipe.image.startsWith('/')) {
    console.error(`❌ ${siteName} recipe image: sample recipe has no site-relative image path`);
    return 1;
  }

  const imageUrl = new URL(sampleRecipe.image.replace(/^\//, ''), `${siteBase.replace(/\/$/, '')}/`).toString();
  const isPages = /github\.io/i.test(siteBase);
  try {
    const res = isPages
      ? await fetchWithRetry(imageUrl, { attempts: 6, baseDelayMs: 3000 })
      : await fetch(imageUrl, { redirect: 'follow' });
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

/** After batch 9, production JS should include the community gallery upload panel. */
async function smokeVercelGalleryBundle(vercelBase) {
  const name = 'Vercel gallery upload bundle';
  const indexUrl = `${vercelBase.replace(/\/$/, '')}/`;

  try {
    const indexRes = await fetch(indexUrl, { redirect: 'follow' });
    if (!indexRes.ok) {
      console.error(`❌ ${name}: index HTTP ${indexRes.status}`);
      return 1;
    }
    const html = await indexRes.text();
    const scriptMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (!scriptMatch) {
      console.warn(`⚠️  ${name}: could not find main JS bundle in index.html (skipping)`);
      return 0;
    }
    const jsUrl = new URL(scriptMatch[1], indexUrl).toString();
    const jsRes = await fetch(jsUrl, { redirect: 'follow' });
    if (!jsRes.ok) {
      console.error(`❌ ${name}: bundle HTTP ${jsRes.status}`);
      return 1;
    }
    const js = await jsRes.text();
    const markers = ['Share a memory', 'gallery-upload-submit', 'Add to gallery'];
    const missing = markers.filter((m) => !js.includes(m));
    if (missing.length > 0) {
      console.error(`❌ ${name}: bundle missing ${missing.join(', ')} (deploy may still be propagating)`);
      return 1;
    }
    console.log(`✅ ${name}`);
    return 0;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    return 1;
  }
}

/** PR #64 launch features should be present across production JS chunks (incl. lazy). */
async function smokeVercelLaunchBundle(vercelBase) {
  const name = 'Vercel launch feature bundle';
  const indexUrl = `${vercelBase.replace(/\/$/, '')}/`;
  const siteBase = vercelBase.replace(/\/$/, '');

  try {
    const indexRes = await fetch(indexUrl, { redirect: 'follow' });
    if (!indexRes.ok) {
      console.error(`❌ ${name}: index HTTP ${indexRes.status}`);
      return 1;
    }
    const html = await indexRes.text();
    const entryPaths = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    if (entryPaths.length === 0) {
      console.warn(`⚠️  ${name}: could not find JS bundles in index.html (skipping)`);
      return 0;
    }

    const seen = new Set();
    const queue = [...entryPaths];
    const texts = [];

    while (queue.length > 0 && seen.size < 40) {
      const src = queue.shift();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      const jsUrl = src.startsWith('http') ? src : `${siteBase}${src.startsWith('/') ? '' : '/'}${src}`;
      const jsRes = await fetch(jsUrl, { redirect: 'follow' });
      if (!jsRes.ok) continue;
      const body = await jsRes.text();
      texts.push(body);
      for (const match of body.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.js/g)) {
        if (!seen.has(match[0])) queue.push(match[0]);
      }
      for (const match of body.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)) {
        const path = `/assets/${match[1]}`;
        if (!seen.has(path)) queue.push(path);
      }
      // Vite dynamic imports often reference bare hashed filenames (no /assets/).
      for (const match of body.matchAll(/([A-Za-z][A-Za-z0-9_-]*-[A-Za-z0-9_-]+\.js)/g)) {
        const path = `/assets/${match[1]}`;
        if (!seen.has(path)) queue.push(path);
      }
    }

    const js = texts.join('\n');
    const markers = [
      'Print the family cookbook',
      'open-cookbook-print',
      'recipe-step-timer-start',
      'Family Notes',
    ];
    const missing = markers.filter((m) => !js.includes(m));
    if (missing.length > 0) {
      console.error(`❌ ${name}: bundle missing ${missing.join(', ')} (deploy may still be propagating)`);
      return 1;
    }
    console.log(`✅ ${name}`);
    return 0;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    return 1;
  }
}

/** Notify API should reject unauthenticated POST (proves route is deployed). */
async function smokeVercelNotifyRoute(vercelBase) {
  const name = 'Vercel /api/notify route';
  const url = `${vercelBase.replace(/\/$/, '')}/api/notify`;
  try {
    const postRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'smoke', body: 'test' }),
    });
    if (postRes.status !== 401) {
      console.error(`❌ ${name}: expected HTTP 401 without secret, got ${postRes.status}`);
      return 1;
    }
    console.log(`✅ ${name}`);
    return 0;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    return 1;
  }
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
    failed += await smokeVercelGalleryBundle(vercel.url);
    failed += await smokeVercelLaunchBundle(vercel.url);
    failed += await smokeVercelNotifyRoute(vercel.url);
  }

  process.exit(failed > 0 ? 1 : 0);
}

smoke();
